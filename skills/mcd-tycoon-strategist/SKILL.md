---
name: mcd-tycoon-strategist
description: 麦当劳大亨经营模拟 + 麦门省钱攻略。用真实麦当劳 MCP 菜单/价格经营餐厅，看 LLM 顾客用脚投票；每局结束生成个性化省钱攻略（领券、组合、避坑）。触发词：麦当劳大亨、麦门经营、开个麦当劳、麦门省钱攻略、玩经营游戏。
---

# 麦当劳大亨 · mcd-tycoon-strategist

玩着游戏把麦当劳的钱省了：经营一家麦当劳 7 天，顾客是 LLM 驱动的 NPC；
每局结束，根据你的消费习惯生成一份个性化麦门省钱攻略。

## 使用方式

安装后直接说：

- 「用麦当劳大亨开局」
- 「今天把巨无霸降到 19.9，备货 80 个」
- 「推进一天，看看顾客反应」
- 「跑一个名场面看看」（薯条定价 99 元）
- 「看看这周战报和省钱攻略」

## 入口脚本

```bash
python skills/mcd-tycoon-strategist/scripts/run.py
```

## 数据来源

- live：环境变量 `MCD_MCP_TOKEN` 存在时，从 `https://mcp.mcd.cn` 拉取真实菜单/价格/优惠券；
- mock：无 Token 时使用 `data/` 下演示快照，玩法完整。

详见仓库 `README.md` 与 `MCP_INTEGRATION.md`。非麦当劳官方产品，粉丝参赛作品。
