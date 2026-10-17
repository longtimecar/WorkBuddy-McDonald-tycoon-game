---
name: mcd-tycoon
description: 麦当劳大亨经营模拟游戏。用自然语言经营一家麦当劳：开局、定价、备货、营销、推进每一天、查看经营战报。菜单数据来自麦当劳中国官方 MCP，支持离线演示快照。触发词：麦当劳大亨、麦麦经营、开个麦当劳、玩经营游戏。
---

# 麦当劳大亨 · WorkBuddy Skill

用自然语言经营一家麦当劳餐厅。真实菜单来自麦当劳中国官方 MCP，顾客是 LLM 驱动的 NPC，会吐槽、会用脚投票。

## 使用方式

安装后直接说：

- "用麦当劳大亨开局"
- "今天把巨无霸降到 19.9，备货 80 个"
- "推进一天，看看顾客反应"
- "看看这周战报"

Skill 会调用 `game/` 目录下的经营引擎（`python -m game`）推进游戏，并用 `game/report.py` 渲染每日战报。

## 数据来源

- live：环境变量 `MCD_MCP_TOKEN` 存在时，从 `https://mcp.mcd.cn` 拉取真实菜单/价格；
- mock：无 Token 时使用 `data/menu.snapshot.json` 演示快照，玩法完整。

## 文件

- `game/engine.py` — 经营引擎（定价→客流→顾客→事件→结算→口碑）
- `game/customers.py` — 顾客 NPC 模型
- `game/report.py` — 日报 / 战报渲染
- `mcdmcp/client.py` — 麦当劳 MCP 客户端（live/mock）

详见仓库 `README.md` 与 `MCP_INTEGRATION.md`。
