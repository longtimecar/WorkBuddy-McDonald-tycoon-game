"""省钱攻略生成器 —— 游戏的「收藏物」。

把一局经营中暴露的消费习惯（店里的畅销品、你的定价、客流）变成一份
个性化麦门省钱攻略：该领哪些券、怎么组合、能省多少、避开什么坑。

star 收藏的是这份攻略，传播的是游戏本身。

数据来源与游戏一致：
- live：MCP available-coupons / calculate-price（接真实门店券）
- mock：data/coupons.snapshot.json 演示券池（无 Token 时玩法完整）
"""

from __future__ import annotations

from dataclasses import dataclass

from .data import load_json


@dataclass
class Coupon:
    id: str
    name: str
    kind: str  # full_reduction / fixed_combo / percent_second / percent_all / free_upgrade
    threshold: float
    off: float
    desc: str


def load_coupons() -> list[Coupon]:
    return [Coupon(**c) for c in load_json("coupons.snapshot.json")]


def _apply(coupon: Coupon, basket: list[tuple[str, float, str]]) -> float | None:
    """返回用券后的总价；不满足条件返回 None。basket 项为 (名称, 单价, 品类)。"""
    total = sum(p for _, p, _ in basket)
    if total < coupon.threshold:
        return None
    if coupon.kind == "full_reduction":
        return max(0.0, round(total - coupon.off, 1))
    if coupon.kind == "percent_all":
        return round(total * (1 - coupon.off), 1)
    if coupon.kind == "fixed_combo":
        # 组合价券：需满足组合条件
        if coupon.id == "breakfast-card":
            if sum(1 for _, _, c in basket if c == "breakfast") < 2:
                return None
        if len(basket) < 2:
            return None
        prices = sorted((p for _, p, _ in basket), reverse=True)
        return round(coupon.off + sum(prices[2:]), 1)
    if coupon.kind == "percent_second":
        # 同品类第二件半价：需同品类 ≥2 件，对其中较便宜的一件打折
        by_cat: dict[str, list[float]] = {}
        for _, p, c in basket:
            by_cat.setdefault(c, []).append(p)
        discount = 0.0
        for prices in by_cat.values():
            if len(prices) >= 2:
                discount += min(prices) * coupon.off
                break
        if not discount:
            return None
        return round(total - discount, 1)
    if coupon.kind == "free_upgrade":
        if not any(c == "drink" for _, _, c in basket):
            return None
        return round(total - coupon.off, 1)
    return None


def best_combo(basket: list[tuple[str, float, str]], coupons: list[Coupon]) -> dict:
    """穷举 单券 / 两券叠加，找最省组合（演示模型，确定性算法）。"""
    base = sum(p for _, p, _ in basket)
    best = {"total": base, "saving": 0.0, "used": [], "label": "不用券直购"}

    candidates = []
    for c in coupons:
        t = _apply(c, basket)
        if t is not None:
            candidates.append((t, [c]))
    for i, c1 in enumerate(coupons):
        for c2 in coupons[i + 1:]:
            t1 = _apply(c1, basket)
            if t1 is None:
                continue
            # 简化：两券叠加 = 先用满减/折扣，再用升级类
            if c2.kind in ("full_reduction", "percent_all"):
                t = _apply(c2, [("x", t1, "burger")])
            else:
                t = _apply(c2, basket)
            if t is not None:
                candidates.append((round(t, 1), [c1, c2]))

    for t, used in candidates:
        if t < best["total"]:
            best = {"total": round(t, 1), "saving": round(base - t, 1), "used": used,
                    "label": " + ".join(c.name for c in used)}
    return best


def generate_plan(game) -> dict:
    """从一局游戏生成个性化省钱攻略。"""
    # 用玩家动过价的商品重建「典型一单」（没动过价就用市场价最低的 3 件）
    priced = sorted(
        (it for it in game.items if game.prices[it.id] != it.market),
        key=lambda it: it.cost,
    )
    picks = list(priced[:3])
    if len(picks) < 3:  # 用市场价最低的经典搭配补足：汉堡+小食+饮品
        fillers = sorted(game.items, key=lambda it: it.market)
        for it in fillers:
            if len(picks) >= 3:
                break
            if it not in picks and (not picks or it.category != picks[0].category):
                picks.append(it)
    basket = [(it.name, it.market, it.category) for it in picks]
    coupons = load_coupons()
    combo = best_combo(basket, coupons)

    avg_price_ratio = game.price_attractiveness()
    if avg_price_ratio < 0.85:
        pitfall = "你店里定价普遍低于市场价——顾客省了，但你在给用户做慈善。"
    elif avg_price_ratio > 1.05:
        pitfall = "定价高于市场价时顾客会暴走：先看券，再定价。"
    else:
        pitfall = "定价贴近市场价，顾客无感——省钱的感知来自券，不是涨价。"

    return {
        "basket": basket,
        "base": round(sum(p for _, p, _ in basket), 1),
        "combo": combo,
        "pitfall": pitfall,
        "actions": [
            "先领券再点餐（麦麦省一键领券，游戏内 auto-bind-coupons 同款操作）",
            f"组合用券：{combo['label']}",
            "凑单前先算净变化：为满减而加购常常是坑",
        ],
        "source": "演示券池（mock）｜接入麦当劳 MCP 后为当前门店真实可领券",
    }


def render_plan(plan: dict) -> str:
    lines = []
    lines.append("══════════ 本周麦门省钱攻略 ══════════")
    basket_desc = " + ".join(f"{n} ¥{p:.1f}" for n, p, _ in plan["basket"])
    lines.append(f"根据你这局最常出现的购物车：{basket_desc}")
    lines.append(f"直购总价：¥{plan['base']:.1f}")
    c = plan["combo"]
    lines.append(f"最优组合：{c['label']} → ¥{c['total']:.1f}（省 ¥{c['saving']:.1f}）")
    lines.append("💡 行动项：")
    for i, a in enumerate(plan["actions"], 1):
        lines.append(f"  {i}. {a}")
    lines.append(f"⚠️ 避坑：{plan['pitfall']}")
    lines.append(f"📦 数据来源：{plan['source']}")
    return "\n".join(lines)
