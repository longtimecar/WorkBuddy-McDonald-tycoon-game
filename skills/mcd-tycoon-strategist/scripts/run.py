#!/usr/bin/env python3
"""麦当劳大亨 Skill 入口。

在 WorkBuddy 中通过自然语言触发（如「用麦当劳大亨开局」「跑一个名场面看看」），
本脚本作为 Skill 与游戏引擎之间的薄封装。
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

from game.engine import Tycoon  # noqa: E402
from game.report import render_day  # noqa: E402
from game.advisor import generate_plan, render_plan  # noqa: E402


def run_famous_scene() -> None:
    """名场面：薯条定价 99 元 + 一局省钱攻略。"""
    game = Tycoon()
    game.set_price("fries", 99.0)
    for cat in game.by_cat:
        game.set_stock(cat, 120)
    report = game.run_day(marketing=0)
    print(render_day(report))
    print()
    print(render_plan(generate_plan(game)))


if __name__ == "__main__":
    run_famous_scene()
