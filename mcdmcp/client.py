"""麦当劳中国 MCP 客户端（最小实现）。

支持两种模式：
- live：直连 https://mcp.mcd.cn（Streamable HTTP + Bearer Token），拉取真实菜单/价格；
- mock：无 Token 时使用 data/menu.snapshot.json 演示快照，保证游戏离线可玩。

安全：Token 只从环境变量 MCD_MCP_TOKEN 读取，绝不写入任何文件。
"""

from __future__ import annotations

import json
import os
import urllib.request
import uuid
from pathlib import Path

MCP_URL = "https://mcp.mcd.cn"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class MCDMCPError(RuntimeError):
    pass


class MCDMCPClient:
    def __init__(self, token: str | None = None, mock: bool | None = None):
        self.token = token or os.environ.get("MCD_MCP_TOKEN", "")
        self.mock = (not self.token) if mock is None else mock
        self._id = 0
        self._ready = False

    # ---------- JSON-RPC over Streamable HTTP ----------
    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def _post(self, payload: dict) -> dict:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            MCP_URL,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "Authorization": f"Bearer {self.token}",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode("utf-8", "replace")
        # 服务端可能返回 SSE 帧：取最后一个 data: 行的 JSON
        if "data:" in text:
            for line in reversed(text.splitlines()):
                line = line.strip()
                if line.startswith("data:"):
                    text = line[5:].strip()
                    break
        return json.loads(text)

    def initialize(self) -> None:
        if self._ready or self.mock:
            return
        self._post({
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "mcd-tycoon", "version": "0.1.0"},
            },
        })
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self._ready = True

    def call_tool(self, name: str, arguments: dict | None = None) -> dict:
        if self.mock:
            return self._mock_call(name, arguments or {})
        self.initialize()
        resp = self._post({
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments or {}},
        })
        if "error" in resp:
            raise MCDMCPError(str(resp["error"]))
        return resp.get("result", {})

    # ---------- Mock：演示快照 ----------
    def _mock_call(self, name: str, args: dict) -> dict:
        if name in ("query-meals", "query-meal-detail", "calculate-price"):
            return {"snapshot": True}
        return {"snapshot": True, "note": "mock 模式：未配置 MCD_MCP_TOKEN"}

    # ---------- 游戏数据入口 ----------
    def load_menu(self) -> list[dict]:
        """返回菜单项列表。live 模式走 MCP query-meals，失败回落快照。"""
        if not self.mock:
            try:
                result = self.call_tool("query-meals", {})
                items = _parse_meals(result)
                if items:
                    return items
            except Exception:
                pass  # 回落快照，游戏不中断
        with open(DATA_DIR / "menu.snapshot.json", encoding="utf-8") as f:
            return json.load(f)

    def status(self) -> str:
        return "mock（演示快照）" if self.mock else "live（麦当劳 MCP 直连）"


def _parse_meals(result: dict) -> list[dict]:
    """把 MCP query-meals 返回解析成游戏菜单结构；结构不符时返回空列表触发回落。"""
    try:
        content = result.get("content", [])
        for block in content:
            if block.get("type") == "text":
                data = json.loads(block["text"])
                # 官方返回结构以 open.mcd.cn/mcp/doc 为准；此处仅识别已知形态，
                # 识别不了就返回空 → 回落快照（README 有真实性对照表说明）。
                if isinstance(data, list) and data and "name" in data[0]:
                    return data
    except Exception:
        pass
    return []
