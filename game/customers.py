"""顾客模拟：把每个顾客当成一个独立决策的 NPC。

顾客模型：
- 进店 → 按品类权重想吃的 → 有货才买，没货就暴走（stockout）
- 心里有预算和心理价位（= 市场价 × 事件修正）；总价超预算 → 觉得贵 → 喷 / 离开
- 定价低于市场价 8% 以上 → 有概率夸奖（good_value）
- 40% 概率加购一件
- 超过店铺日出餐能力 → 排队暴走
"""

from __future__ import annotations

import random

CATEGORY_WEIGHTS = {
    "burger": 0.42,
    "side": 0.28,
    "drink": 0.16,
    "dessert": 0.09,
    "breakfast": 0.05,
}


def _pick(taunts: dict, key: str, rng: random.Random) -> str:
    pool = taunts.get(key) or ["（这位顾客选择了沉默）"]
    return rng.choice(pool)


def _weighted_cat(rng: random.Random) -> str:
    r = rng.random()
    acc = 0.0
    for cat, w in CATEGORY_WEIGHTS.items():
        acc += w
        if r <= acc:
            return cat
    return "burger"


def run_customers(game, traffic: int, eff: dict, rng: random.Random) -> dict:
    prices = game.prices
    stock = game.stock
    taunts = game.taunts
    market_mult = eff.get("market", 1.0)
    rage = eff.get("coupon_rage", False)
    rep = game.reputation

    tolerance_base = 0.72 + rep / 220.0  # 口碑越高，顾客容忍度越高
    if rage:
        tolerance_base -= 0.12

    served = praises = angries = stockouts = queue_angry = 0
    revenue = cogs = 0.0
    sold: dict[str, int] = {}
    samples: list[tuple[str, str]] = []

    for i in range(traffic):
        if i >= game.DAILY_CAPACITY:
            queue_angry += 1
            if rng.random() < 0.3:
                samples.append(("angry", _pick(taunts, "queue", rng)))
            continue

        cat = _weighted_cat(rng)
        options = [it for it in game.by_cat.get(cat, []) if stock.get(cat, 0) > 0]
        if not options:
            cat = _weighted_cat(rng)
            options = [it for it in game.by_cat.get(cat, []) if stock.get(cat, 0) > 0]
            if not options:
                stockouts += 1
                if rng.random() < 0.4:
                    samples.append(("angry", _pick(taunts, "stockout", rng)))
                continue

        item = rng.choice(options)
        total = prices[item.id]
        extra = None
        extra_cat = None
        if rng.random() < 0.4:  # 加购
            extra_cat = _weighted_cat(rng)
            opts = [
                it for it in game.by_cat.get(extra_cat, [])
                if stock.get(extra_cat, 0) > 0 and it.id != item.id
            ]
            if opts:
                extra = rng.choice(opts)
                total += prices[extra.id]

        budget = rng.uniform(16, 68)
        if total <= budget * tolerance_base:
            served += 1
            revenue += total
            cogs += item.cost
            stock[cat] -= 1
            sold[item.id] = sold.get(item.id, 0) + 1
            if extra is not None:
                cogs += extra.cost
                stock[extra_cat] -= 1
                sold[extra.id] = sold.get(extra.id, 0) + 1
            ratio = prices[item.id] / (item.market * market_mult)
            if ratio <= 0.92 and rng.random() < 0.4:
                praises += 1
                samples.append(("happy", _pick(taunts, "good_value", rng)))
            elif ratio <= 1.0 and rng.random() < 0.15:
                praises += 1
                samples.append(("happy", _pick(taunts, "good_value", rng)))
        else:
            ratio = prices[item.id] / (item.market * market_mult)
            if ratio > 1.08:
                angries += 1
                if rng.random() < 0.3:
                    samples.append(("angry", _pick(taunts, "high_price", rng)))
            elif rng.random() < 0.25:
                # 觉得贵但没说什么，不计口碑损失
                samples.append(("neutral", _pick(taunts, "high_price", rng)))

    # 口碑差的店，进店的人先吐为敬
    if game.reputation < 55 and rng.random() < 0.3:
        samples.append(("angry", _pick(taunts, "rep_low", rng)))
    elif game.reputation > 85 and rng.random() < 0.3:
        samples.append(("happy", _pick(taunts, "rep_high", rng)))

    return {
        "served": served,
        "revenue": revenue,
        "cogs": cogs,
        "praises": praises,
        "angries": angries,
        "stockouts": stockouts,
        "queue_angry": queue_angry,
        "sold": sold,
        "samples": rng.sample(samples, min(6, len(samples))) if samples else [],
    }
