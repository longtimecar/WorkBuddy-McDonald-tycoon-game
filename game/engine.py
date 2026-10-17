"""核心经营引擎：定价 → 客流 → 顾客决策 → 事件 → 日结算 → 口碑演化。"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .customers import run_customers
from .data import load_json
from .events import combine, roll_events

# 营销投入档位：{档位: (花费, 客流乘数)}
MARKETING = {0: (0.0, 1.0), 1: (150.0, 1.15), 2: (350.0, 1.35), 3: (700.0, 1.60)}

# 备货报废率：生鲜当天报废 30%，饮品甜品 10%
WASTE_RATE = {"burger": 0.3, "side": 0.3, "breakfast": 0.3, "dessert": 0.1, "drink": 0.1}


@dataclass
class Item:
    id: str
    name: str
    category: str
    cost: float
    market: float
    tags: list = field(default_factory=list)


@dataclass
class DayReport:
    day: int
    traffic: int
    served: int
    stockouts: int
    queue_angry: int
    praises: int
    angries: int
    revenue: float
    cogs: float
    waste: float
    marketing_cost: float
    rent: float
    profit: float
    rep_before: float
    rep_after: float
    events: list
    samples: list
    best_seller: str
    cash_after: float


class Tycoon:
    """单店经营模拟 · 7 天挑战模式。"""

    START_CASH = 5000.0
    RENT = 200.0
    BASE_TRAFFIC = 160
    DAILY_CAPACITY = 190
    CHALLENGE_DAYS = 7

    def __init__(self, menu: Optional[list] = None, seed: Optional[int] = None):
        self.rng = random.Random(seed)
        raw = menu if menu is not None else load_json("menu.snapshot.json")
        self.items = [Item(**i) for i in raw]
        self.by_cat: dict[str, list[Item]] = {}
        for it in self.items:
            self.by_cat.setdefault(it.category, []).append(it)
        self.taunts = load_json("taunts.json")
        self.day = 0
        self.cash = self.START_CASH
        self.reputation = 70.0
        self.stock = {c: 0 for c in self.by_cat}
        self.prices = {it.id: it.market for it in self.items}
        self.history: list[DayReport] = []

    # ---------- 玩家操作 ----------
    def set_price(self, item_id: str, price: float) -> None:
        if item_id in self.prices:
            self.prices[item_id] = max(1.0, round(float(price), 1))

    def set_stock(self, category: str, qty: int) -> None:
        if category in self.stock:
            self.stock[category] = max(0, int(qty))

    def reset_prices_to_market(self) -> None:
        for it in self.items:
            self.prices[it.id] = it.market

    # ---------- 模型 ----------
    def price_attractiveness(self) -> float:
        """整体定价吸引力：越低于市场价越高，封顶 1.3 / 保底 0.25。"""
        vals = []
        for it in self.items:
            ratio = self.prices[it.id] / it.market
            vals.append(max(0.25, min(1.3, 1.0 - 1.2 * (ratio - 1.0))))
        return sum(vals) / len(vals)

    def suggest_stock(self) -> dict[str, int]:
        """按昨日客流给一个备货默认值。"""
        last = self.history[-1].traffic if self.history else self.BASE_TRAFFIC
        return {c: int(last * 0.55) for c in self.by_cat}

    # ---------- 一天 ----------
    def run_day(self, marketing: int = 0) -> DayReport:
        self.day += 1
        marketing = max(0, min(3, int(marketing)))
        mkt_cost, mkt_mult = MARKETING[marketing]

        events = roll_events(self.rng)
        eff = combine(events)

        attr = self.price_attractiveness()
        rep_factor = max(0.4, min(1.6, self.reputation / 70.0))
        traffic = int(
            self.BASE_TRAFFIC * attr * rep_factor * eff["traffic"] * mkt_mult
            * self.rng.uniform(0.85, 1.15)
        )
        traffic = max(5, min(400, traffic))

        cust = run_customers(self, traffic, eff, self.rng)

        # 成本与报废
        cogs = cust["cogs"] * eff["cost"]
        waste = sum(
            self.stock[c] * self._cat_avg_cost(c) * WASTE_RATE.get(c, 0.15) * eff["cost"]
            for c in self.stock
        )
        revenue = cust["revenue"]
        profit = revenue - cogs - waste - mkt_cost - self.RENT

        # 口碑演化
        rep_before = self.reputation
        rep_delta = (
            eff["reputation"]
            + 0.05 * cust["praises"]
            - 0.12 * cust["angries"]
            - 0.10 * cust["stockouts"]
            - 0.08 * cust["queue_angry"]
        )
        satisfaction = cust["praises"] / max(1, cust["praises"] + cust["angries"])
        target = 55 + 40 * satisfaction
        rep_after = max(0.0, min(100.0, self.reputation + 0.12 * (target - self.reputation) + rep_delta))
        self.reputation = rep_after

        self.cash += profit

        best = max(cust["sold"].items(), key=lambda kv: kv[1], default=("—", 0))
        best_name = self._item_name(best[0])

        report = DayReport(
            day=self.day,
            traffic=traffic,
            served=cust["served"],
            stockouts=cust["stockouts"],
            queue_angry=cust["queue_angry"],
            praises=cust["praises"],
            angries=cust["angries"],
            revenue=round(revenue, 1),
            cogs=round(cogs, 1),
            waste=round(waste, 1),
            marketing_cost=mkt_cost,
            rent=self.RENT,
            profit=round(profit, 1),
            rep_before=round(rep_before, 1),
            rep_after=round(rep_after, 1),
            events=events,
            samples=cust["samples"],
            best_seller=best_name,
            cash_after=round(self.cash, 1),
        )
        self.history.append(report)
        return report

    def _cat_avg_cost(self, cat: str) -> float:
        items = self.by_cat.get(cat, [])
        return sum(i.cost for i in items) / len(items) if items else 0.0

    def _item_name(self, item_id: str) -> str:
        for it in self.items:
            if it.id == item_id:
                return it.name
        return "—"
