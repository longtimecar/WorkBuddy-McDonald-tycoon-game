"""随机事件系统：每天 0-2 个事件，效果叠加后作用于当日经营。"""

from __future__ import annotations

from .data import load_json


def load_events() -> list[dict]:
    return load_json("events.json")


def roll_events(rng, count_max: int = 2) -> list[dict]:
    pool = load_events()
    total = sum(e["weight"] for e in pool)
    picked: list[dict] = []
    for _ in range(rng.randint(0, count_max)):
        r = rng.uniform(0, total)
        acc = 0.0
        for e in pool:
            acc += e["weight"]
            if r <= acc:
                if e not in picked:
                    picked.append(e)
                break
    return picked


def combine(events: list[dict]) -> dict:
    eff = {"traffic": 1.0, "reputation": 0.0, "cost": 1.0, "market": 1.0, "coupon_rage": False}
    for ev in events:
        for k, v in ev.get("effects", {}).items():
            if k == "traffic":
                eff["traffic"] *= v
            elif k == "reputation":
                eff["reputation"] += v
            elif k == "cost":
                eff["cost"] *= v
            elif k == "market":
                eff["market"] *= v
            elif k == "coupon_rage":
                eff["coupon_rage"] = True
    return eff
