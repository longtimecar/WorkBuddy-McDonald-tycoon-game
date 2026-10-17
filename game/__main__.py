"""麦当劳大亨 · CLI 入口。

用法：
    python -m game            # 交互式 7 天经营挑战
    python -m game --demo     # 演示模式：复现「薯条定价 99 元」名场面（录屏/GIF 素材）
    python -m game --live     # 连接麦当劳 MCP 拉取真实菜单（需要环境变量 MCD_MCP_TOKEN）
    python -m game --seed 42  # 固定随机种子（可复现）
"""

from __future__ import annotations

import argparse
import sys

from .engine import MARKETING, Tycoon
from mcdmcp.client import MCDMCPClient
from .report import render_day, render_final

CATEGORY_CN = {"burger": "汉堡", "side": "小食", "dessert": "甜品", "drink": "饮品", "breakfast": "早餐"}


def _ask(prompt: str, default: str = "") -> str:
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print("\n已退出。")
        sys.exit(0)


def setup_day(game: Tycoon, marketing: int) -> None:
    print(f"\n════════ 第 {game.day + 1} 天 备餐 ════════")
    print(f"现金 ¥{game.cash:.1f} ｜ 口碑 {game.reputation:.1f} ｜ 备货中：" +
          " ".join(f"{CATEGORY_CN.get(c, c)}{q}份" for c, q in game.stock.items()))

    # 改价
    print("\n当前定价（序号=新定价，多个用逗号隔开，回车全部不变）：")
    for idx, it in enumerate(game.items, 1):
        cur = game.prices[it.id]
        mark = "" if cur == it.market else "  ←已改"
        print(f"  {idx:>2}. {it.name:<10} 成本¥{it.cost:<5} 市场¥{it.market:<5} 现价¥{cur}{mark}")
    raw = _ask("改价> ")
    if raw:
        for part in raw.replace("，", ",").split(","):
            if "=" not in part:
                continue
            k, v = part.split("=", 1)
            try:
                i = int(k.strip())
                p = float(v.strip())
                if 1 <= i <= len(game.items):
                    game.set_price(game.items[i - 1].id, p)
            except ValueError:
                print(f"  忽略无法识别的输入：{part}")

    # 备货
    print("\n备货（回车用建议值，生鲜当天报废30%）")
    suggest = game.suggest_stock()
    for cat in game.by_cat:
        raw = _ask(f"  {CATEGORY_CN.get(cat, cat)} 备货（建议 {suggest[cat]}）> ")
        game.set_stock(cat, int(raw) if raw.isdigit() else suggest[cat])

    # 营销
    mkt = _ask(f"营销投入 0-3（当前 {marketing}，0不投/1传单¥150/2社群¥350/3联名¥700）> ")
    if mkt.isdigit() and 0 <= int(mkt) <= 3:
        marketing = int(mkt)
    return marketing


def run_demo(game: Tycoon) -> None:
    """名场面复现：薯条定价 99 元。"""
    print("\n🎬 演示模式：把薯条定价 99 元，看看顾客什么反应……\n")
    game.set_price("fries", 99.0)
    for cat in game.by_cat:
        game.set_stock(cat, 150)
    report = game.run_day(marketing=0)
    print(render_day(report))


def main() -> None:
    parser = argparse.ArgumentParser(prog="game", description="麦当劳大亨 · 经营模拟")
    parser.add_argument("--seed", type=int, default=None, help="固定随机种子")
    parser.add_argument("--demo", action="store_true", help="演示模式：薯条定价99元名场面")
    parser.add_argument("--live", action="store_true", help="连接麦当劳 MCP 拉取真实菜单")
    parser.add_argument("--days", type=int, default=Tycoon.CHALLENGE_DAYS, help="挑战天数")
    args = parser.parse_args()

    client = MCDMCPClient(mock=not args.live)
    menu = client.load_menu()
    game = Tycoon(menu=menu, seed=args.seed)
    game.CHALLENGE_DAYS = max(1, args.days)

    print("🍔 麦当劳大亨 · WorkBuddy-McDonald-tycoon-game")
    print(f"数据源：{client.status()} ｜ 菜单 {len(game.items)} 款 ｜ 挑战 {game.CHALLENGE_DAYS} 天")
    print("非麦当劳官方产品，粉丝参赛作品；演示数据以官方实时渠道为准。")

    if args.demo:
        run_demo(game)
        return

    marketing = 0
    while game.day < game.CHALLENGE_DAYS:
        marketing = setup_day(game, marketing)
        report = game.run_day(marketing=marketing)
        print()
        print(render_day(report))

    print()
    print(render_final(game))


if __name__ == "__main__":
    main()
