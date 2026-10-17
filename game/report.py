"""日报 / 终局战报渲染（纯文本，零依赖）。"""

from __future__ import annotations

from .engine import DayReport, Tycoon


def render_day(r: DayReport) -> str:
    lines = []
    lines.append(f"────── 第 {r.day} 天 日报 ──────")
    if r.events:
        lines.append("📢 今日事件：" + "；".join(f"{e['name']}（{e['desc']}）" for e in r.events))
    lines.append(
        f"客流 {r.traffic} 人 ｜ 成交 {r.served} 单 ｜ 缺货流失 {r.stockouts} ｜ 排队暴走 {r.queue_angry}"
    )
    lines.append(
        f"营收 ¥{r.revenue:.1f} ｜ 食材 ¥{r.cogs:.1f} ｜ 报废 ¥{r.waste:.1f} "
        f"｜ 营销 ¥{r.marketing_cost:.0f} ｜ 房租 ¥{r.rent:.0f}"
    )
    profit_line = f"💰 今日利润：¥{r.profit:+.1f}"
    lines.append(profit_line)
    lines.append(
        f"口碑 {r.rep_before:.1f} → {r.rep_after:.1f} ｜ 现金 ¥{r.cash_after:.1f} ｜ 今日销冠：{r.best_seller}"
    )
    if r.samples:
        lines.append("💬 顾客说：")
        for mood, text in r.samples:
            mark = "😍" if mood == "happy" else "😡"
            lines.append(f"  {mark} {text}")
    return "\n".join(lines)


def _grade(profit: float, rep: float) -> tuple[str, str]:
    if profit >= 8000 and rep >= 85:
        return "S", "麦门之星 · 顾客排队到马路对面"
    if profit >= 5000 and rep >= 75:
        return "A", "金牌店长 · 营收口碑双丰收"
    if profit >= 2500 and rep >= 60:
        return "B", "稳扎稳打 · 差点意思"
    return "C", "再练练 · 麦当劳教我做汉堡"


def render_final(game: Tycoon) -> str:
    total_profit = sum(r.profit for r in game.history)
    avg_rep = sum(r.rep_after for r in game.history) / max(1, len(game.history))
    grade, title = _grade(total_profit, avg_rep)
    worst_stockout = max(game.history, key=lambda r: r.stockouts, default=None)
    best_day = max(game.history, key=lambda r: r.profit, default=None)

    lines = []
    lines.append(f"══════════ {game.CHALLENGE_DAYS} 天经营战报 ══════════")
    lines.append(f"总利润：¥{total_profit:+.1f} ｜ 终局现金：¥{game.cash:.1f} ｜ 平均口碑：{avg_rep:.1f}")
    lines.append(f"评级：{grade} —— {title}")
    lines.append("")
    lines.append("每日营收曲线：")
    peak = max((abs(r.revenue) for r in game.history), default=1) or 1
    for r in game.history:
        bar = "█" * max(1, int(r.revenue / peak * 40))
        lines.append(f"  Day{r.day} |{bar:<40}| ¥{r.revenue:.0f}")
    lines.append("")
    if worst_stockout and worst_stockout.stockouts > 0:
        lines.append(f"😱 最大翻车：第 {worst_stockout.day} 天缺货流失 {worst_stockout.stockouts} 人")
    if best_day:
        lines.append(f"🏆 最佳单日：第 {best_day.day} 天利润 ¥{best_day.profit:+.1f}")
    savage = [s for r in game.history for s in r.samples if s[0] == "angry"]
    if savage:
        lines.append(f"🔥 名场面收录：{len(savage)} 条顾客暴走瞬间（截图即素材）")
    return "\n".join(lines)
