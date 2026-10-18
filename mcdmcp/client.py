"""麦当劳中国 MCP 客户端（v0.3 · live 全链路）。

实测可用的调用链（2026-10-17 夜间验证）：
1. query-nearby-stores {beType:1, searchType:2, city, keyword}  → storeCode
   （searchType=2 时 city 与 keyword 必填，缺一个报 600058）
2. query-meals {storeCode, beType:1, orderType:1}               → 分类 + 餐品 code 列表
3. query-meal-detail {storeCode, beType:1, orderType:1, code}   → 餐品详情/价格
4. campaign-calendar {}                                         → markdown 活动列表
5. available-coupons {}                                         → markdown 可领券列表

所有工具返回都是「markdown 说明 + 内嵌 JSON」，用 _extract 提取。
mock 模式（无 Token）用 data/*.snapshot.json，玩法完整。

安全：Token 只从环境变量 MCD_MCP_TOKEN 读取，绝不写入任何文件。
"""

from __future__ import annotations

import json
import os
import re
import urllib.request
from pathlib import Path

MCP_URL = "https://mcp.mcd.cn"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# 游戏分类 ← MCP 菜单分类名 的关键词映射
_CATEGORY_KEYWORDS = {
    "burger": ["汉堡", "堡", "卷", "牛肉"],
    "side": ["小食", "拼盘", "多人餐", "配餐", "薯"],
    "dessert": ["甜品", "冰淇淋", "派", "蛋糕", "下午茶"],
    "drink": ["饮品", "饮料", "咖啡", "麦咖啡", "可乐", "果汁"],
    "breakfast": ["早餐"],
}

# 游戏分类 ← 菜品名 的关键词映射（优先；MCP 分类名极不可靠，实测
# "麦咖啡™美式" 被归进小食类，只能按菜品名里的词判定）
_ITEM_CATEGORY_KEYWORDS = {
    "breakfast": ["早餐", "猪柳", "柳蛋", "豆浆", "油条", "热香饼", "早晨"],
    "dessert": ["甜筒", "圣代", "冰淇淋", "冰淇凌", "麦旋风", "蛋挞", "布丁", "蛋糕", "派"],
    "drink": ["美式", "拿铁", "摩卡", "咖啡", "可乐", "雪碧", "红茶", "绿茶", "果汁", "鲜橙", "雪梨", "饮料"],
    "burger": ["汉堡", "牛堡", "鸡腿堡", "吉士堡", "堡"],
    # side 兜底：薯、鸡块、翅、拼盘、套餐等
}

# 非餐品过滤：周边商品与单卖酱料不进游戏菜单
_NON_FOOD_PATTERNS = ["徽章", "帽", "贴纸", "贴", "捶", "挠", "玩偶", "周边", "收藏", "手办"]

# 游戏需要的全部品类（缺的由演示快照补全，保证顾客模型五类齐全）
GAME_CATEGORIES = ["burger", "side", "drink", "dessert", "breakfast"]


class MCDMCPError(RuntimeError):
    pass


def _extract_json(text: str) -> dict | None:
    """从「markdown + 内嵌 JSON」的返回中提取完整 JSON 对象。"""
    idx = text.find('{"success"')
    if idx < 0:
        return None
    depth = 0
    for j in range(idx, len(text)):
        ch = text[j]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[idx:j + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _find_str(obj, keys: tuple[str, ...]) -> str | None:
    """在嵌套结构里找第一个命中 keys 的非空字符串值。"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in keys and isinstance(v, str) and v.strip():
                return v.strip()
        for v in obj.values():
            r = _find_str(v, keys)
            if r:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find_str(v, keys)
            if r:
                return r
    return None


def _find_price(obj) -> float | None:
    """找价格字段，兼容「元」字符串与「分」整数两种口径。"""
    if isinstance(obj, dict):
        for k in ("currentPrice", "salePrice", "price", "promotionPrice"):
            v = obj.get(k)
            if v not in (None, "", "0", 0):
                try:
                    p = float(v)
                    if p > 100:  # 口径为分
                        p /= 100
                    if 0 < p < 200:
                        return round(p, 1)
                except (TypeError, ValueError):
                    pass
        for v in obj.values():
            r = _find_price(v)
            if r:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find_price(v)
            if r:
                return r
    return None


class MCDMCPClient:
    def __init__(self, token: str | None = None, mock: bool | None = None):
        self.token = token or os.environ.get("MCD_MCP_TOKEN", "")
        self.mock = (not self.token) if mock is None else mock
        self._id = 0
        self._ready = False

    # ---------- JSON-RPC ----------
    def _rpc(self, method: str, params: dict | None = None, notify: bool = False) -> dict | None:
        self._id += 1
        payload: dict = {"jsonrpc": "2.0", "method": method}
        if not notify:
            payload["id"] = self._id
            if params:
                payload["params"] = params
        req = urllib.request.Request(
            MCP_URL,
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "Authorization": f"Bearer {self.token}",
            },
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            text = resp.read().decode("utf-8", "replace")
        if notify:
            return None
        if "data:" in text:  # SSE 帧
            for line in reversed(text.splitlines()):
                if line.strip().startswith("data:"):
                    text = line.strip()[5:].strip()
                    break
        return json.loads(text)

    def _call(self, name: str, arguments: dict) -> dict:
        """调用工具并提取内嵌 JSON；失败抛 MCDMCPError。"""
        resp = self._rpc("tools/call", {"name": name, "arguments": arguments})
        if resp is None or "error" in resp:
            raise MCDMCPError(str(resp))
        content = (resp.get("result") or {}).get("content") or []
        for block in content:
            if block.get("type") == "text":
                data = _extract_json(block["text"])
                if data is not None:
                    return data
        raise MCDMCPError(f"{name} 返回中未找到 JSON")

    def _call_text(self, name: str, arguments: dict | None = None) -> str:
        resp = self._rpc("tools/call", {"name": name, "arguments": arguments or {}})
        content = (resp.get("result") or {}).get("content") or []
        for block in content:
            if block.get("type") == "text":
                return block["text"]
        return ""

    def connect(self) -> None:
        if self._ready or self.mock:
            return
        self._rpc("initialize", {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "mcd-tycoon", "version": "0.3.0"},
        })
        self._rpc("notifications/initialized", notify=True)
        self._ready = True

    # ---------- 业务方法 ----------
    def find_store(self, city: str = "上海市", keyword: str = "麦当劳") -> tuple[str, str]:
        """返回 (storeCode, 门店名)。"""
        data = self._call("query-nearby-stores",
                          {"beType": 1, "searchType": 2, "city": city, "keyword": keyword})
        stores = data.get("data") or []
        if not stores:
            raise MCDMCPError("未找到门店")
        return stores[0].get("storeCode", ""), stores[0].get("storeName", "")

    def load_menu(self, city: str = "上海市", keyword: str = "麦当劳",
                  max_items: int = 48) -> list[dict]:
        """真实菜单 → 游戏菜单结构。

        实测返回结构：data.categories[].meals[] 只有 {code, tags} 存根；
        真正的 {name, currentPrice, originalPrice, discountType} 在
        data.meals 这个以 code 为键的映射表里。一次调用拿全菜单。
        任何一步失败都会抛错，由调用方回落快照。
        """
        self.connect()
        store_code, _ = self.find_store(city, keyword)
        resp = self._call("query-meals",
                          {"storeCode": store_code, "beType": 1, "orderType": 1})
        data = resp.get("data") or {}
        info_map = data.get("meals") or {}
        categories = data.get("categories") or []

        items: list[dict] = []
        seen: set[str] = set()
        for cat in categories:
            cat_name = cat.get("name", "")
            for stub in cat.get("meals") or []:
                code = stub.get("code")
                if not code or code in seen or len(items) >= max_items:
                    continue
                info = info_map.get(code) or {}
                name = info.get("name")
                try:
                    price = float(info.get("currentPrice") or info.get("originalPrice") or 0)
                except (TypeError, ValueError):
                    price = 0.0
                if not name or price <= 0:
                    continue
                seen.add(code)
                tags = list(stub.get("tags") or [])
                if info.get("discountType"):
                    tags.append(info["discountType"])
                if not self._is_food(name, tags):
                    continue  # 周边/徽章/酱料等非餐品不入游戏菜单
                items.append({
                    "id": code,
                    "name": name,
                    "category": self._map_item_category(name, cat_name),
                    # MCP 不含成本价，按市场价 55% 估算（游戏假设，README 有对照表）
                    "cost": round(price * 0.55, 1),
                    "market": price,
                    "tags": tags,
                })
        return items

    def load_campaigns(self) -> list[str]:
        """当月活动标题（markdown 列表 → 字符串列表）。"""
        text = self._call_text("campaign-calendar", {})
        return [t.strip() for t in re.findall(r"\*\*活动标题\*\*：(.+)", text)]

    def load_coupon_titles(self) -> list[str]:
        """当前可领券标题（markdown 列表 → 字符串列表）。"""
        text = self._call_text("available-coupons", {})
        return [t.strip() for t in re.findall(r"优惠券标题：(.+?)\s*\\?\s*\n", text) if t.strip()]

    @staticmethod
    def _map_category(cat_name: str) -> str:
        for game_cat, kws in _CATEGORY_KEYWORDS.items():
            if any(k in cat_name for k in kws):
                return game_cat
        return "side"

    @staticmethod
    def _is_food(name: str, tags: list) -> bool:
        """过滤非餐品：周边商品（徽章/帽子/贴纸/痒痒挠）与单卖酱料。"""
        if any(p in name for p in _NON_FOOD_PATTERNS):
            return False
        if name.rstrip("）)").endswith("酱"):
            return False
        return True

    @staticmethod
    def _map_item_category(name: str, cat_name: str) -> str:
        """按菜品名判定品类（优先），分类名兜底。实测 MCP 分类名极不可靠
        （麦咖啡美式曾被归进小食），菜品名里的关键词才准确。"""
        for game_cat, kws in _ITEM_CATEGORY_KEYWORDS.items():
            if any(k in name for k in kws):
                return game_cat
        return MCDMCPClient._map_category(cat_name)

    def status(self) -> str:
        return "mock（演示快照）" if self.mock else "live（麦当劳 MCP 直连）"

    # ---------- 游戏数据入口 ----------
    def load_game_menu(self, city: str = "上海市", keyword: str = "麦当劳") -> tuple[list[dict], str]:
        """返回 (菜单, 数据源说明)。live 失败自动回落演示快照。

        live 菜单若缺少游戏所需的品类（如该门店没返甜品/早餐），
        用演示快照对应品类补全，并在数据源说明里注明，保证顾客模型五类齐全。
        """
        if not self.mock:
            try:
                items = self.load_menu(city, keyword)
                if items:
                    items, note = self._fill_missing_categories(items)
                    return items, f"live · 麦当劳 MCP 真实菜单（{city}）{note}"
            except Exception:
                pass
        with open(DATA_DIR / "menu.snapshot.json", encoding="utf-8") as f:
            return json.load(f), "mock · 演示快照"

    @staticmethod
    def _fill_missing_categories(items: list[dict]) -> tuple[list[dict], str]:
        have = {it["category"] for it in items}
        missing = [c for c in GAME_CATEGORIES if c not in have]
        if not missing:
            return items, ""
        with open(DATA_DIR / "menu.snapshot.json", encoding="utf-8") as f:
            snap = json.load(f)
        fill = [it for it in snap if it["category"] in missing]
        label = {"burger": "汉堡", "side": "小食", "drink": "饮品",
                 "dessert": "甜品", "breakfast": "早餐"}
        note = "（" + "/".join(label[c] for c in missing) + "品类为演示补充）"
        return items + fill, note
