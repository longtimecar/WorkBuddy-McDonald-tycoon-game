# 🍔 麦当劳大亨 WorkBuddy-McDonald-tycoon-game

> **玩 7 天麦当劳，顺手省出一只巨无霸。**
> 用麦当劳官方 MCP 的真实菜单经营你自己的店，LLM 顾客会点单、会吐槽、会用脚投票——
> 每局结束，还你一份个性化省钱攻略。

[📺 视频演示](#)　[📖 中文](#中文说明)　[English](#english)

> 🎮 在线试玩版制作中（GitHub Pages，10/18 上线）

**非麦当劳官方产品，粉丝参赛作品**（麦当劳程序员节创意开发大赛）。餐品信息、价格及供应状态以麦当劳官方渠道实时结果为准。

**为什么是它**：省钱 Skill 榜上已经有 100 个了，会玩的一个都没有。我们做全场第一个「好玩到你想截图、又实用到你想收藏」的麦当劳 Skill——游戏是钩子，省钱攻略是本体。

---

## 中文说明

### 这是什么

《麦当劳大亨》是一个**餐厅经营模拟游戏**：你接手一家麦当劳，每天做三个决定——**定价、备货、营销**，然后看着真实菜单数据驱动的顾客们用脚投票。

- 🥤 菜单和价格来自**麦当劳中国官方 MCP**（`query-meals` / `calculate-price`），不是编的；
- 🤬 LLM 顾客会点单、会吐槽、会因为你把薯条定价 99 元喷上差评热搜（**离线模式**无需 API Key 照样玩）；
- 🎲 随机事件：暴雨、竞对开业、网红探店、1024 程序员节彩蛋……
- 💰 **每局结束自动生成「本周麦门省钱攻略」**：根据你的消费习惯算最优券组合，star 收藏的是这份攻略；
- 📈 每日经营战报自动出图，截图即社交素材；
- ⏱️ **7 天挑战模式**：7 天后看总利润和口碑评级（S/A/B/C）。

### 30 秒上手

```bash
git clone https://github.com/longtimecar/WorkBuddy-McDonald-tycoon-game.git
cd WorkBuddy-McDonald-tycoon-game
python -m game
```

复现名场面（录屏素材）：

```bash
python -m game --demo   # 薯条定价 99 元，看顾客暴走 + 省钱攻略
```

### 三种形态

| 入口 | 命令 / 方式 | 适合谁 |
|---|---|---|
| CLI | `python -m game` | 开发者，终端里直接玩 |
| Web | 打开 `docs/index.html`（GitHub Pages） | 所有人，打开即玩 |
| Skill | `cp -r skills/mcd-tycoon-strategist ~/.workbuddy/skills/` | AI 玩家，自然语言开局 |

### 安装为 WorkBuddy Skill

```bash
cp -r skills/mcd-tycoon-strategist ~/.workbuddy/skills/   # Windows: %USERPROFILE%\.workbuddy\skills\
```

装好后在对话框里直接说「用麦当劳大亨开局」或「跑一个名场面看看」。

### 接入真实麦当劳 MCP（可选）

```bash
export MCD_MCP_TOKEN="你的Token"   # 在 open.mcd.cn/mcp 免费申请
python -m game --live              # 拉取实时真实菜单与优惠券
```

无 Token 时自动使用内置演示快照，玩法完整。

### 目录结构

```
├── game/            # 游戏引擎（纯标准库）：经营循环 / 顾客NPC / 事件 / 省钱攻略
├── mcdmcp/          # 麦当劳 MCP 客户端（live/mock 双模式）
├── data/            # 菜单快照 / 事件池 / 吐槽语料 / 券池（数据驱动）
├── skills/          # WorkBuddy Skill 安装形态
├── docs/index.html  # Web 版（GitHub Pages）
├── SKILL.md
└── MCP_INTEGRATION.md  # MCP 集成说明（参赛必交）
```

### 路线图（一仓多世界）

麦当劳 MCP 是一座山，我们只开了第一个世界：

- ✅ **世界一 · 大亨**：经营模拟 + 省钱攻略（当前版本）
- 🔜 **世界二 · 答案之书**：不要问 AI，问薯条
- 🔜 **世界三 · 麦门年报**：你的麦当劳年度数据全景报告

同一个 MCP 数据底座，多个世界互相导流——关注仓库，世界二上线第一时间知道。

### 目标用户

- 想 3 分钟看懂一个游戏多好玩的**普通玩家**（Web 版打开即玩）；
- 想看看"麦当劳官方 MCP 还能这么用"的**开发者**（CLI + 源码 + MCP_INTEGRATION.md）；
- 需要社交谈资的**所有人**（顾客吐槽截图 + 每日战报图 + 省钱攻略）。

---

## English

**McDonald Tycoon** — run your own McDonald's restaurant with real menu data from McDonald's China official MCP. Set prices, stock up, market your store, and watch LLM-powered customers vote with their feet. Every run ends with a personalized money-saving plan — play the game, keep the guide.

```bash
python -m game          # play in your terminal
python -m game --demo   # the "¥99 fries" famous scene + saving plan
python -m game --live   # real menu & coupons via official McDonald's MCP
```

No build, no dependencies, Python 3.11+ standard library only. An offline mode keeps it fully playable without any API key.

### Disclaimer

Fan-made project for the McDonald's Programmers' Day hackathon. Not affiliated with or endorsed by McDonald's. Menu, prices and availability follow McDonald's official channels.
