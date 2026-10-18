# workbuddy.md — 《麦当劳大亨》开发过程全记录

> 本文件记录本项目使用 WorkBuddy 的完整开发过程，用于核验 WorkBuddy 联动活动奖励条件。
> 项目：麦当劳大亨（WorkBuddy-McDonald-tycoon-game）
> 开发时间：2026-10-17 ～ 2026-10-18（赛程第 9-10 天，共 2 个工作日）
> 开发者：陈天程（longtimecar）｜主力开发工具：WorkBuddy（Claude 模型）

---

## 一、项目是什么

《麦当劳大亨》是一个基于**麦当劳中国官方 MCP** 真实数据的餐厅经营模拟游戏：

- 玩家每天做三个决策：**定价、备货、营销**，然后看顾客用脚投票
- 菜单与价格来自 MCP `query-meals` 实时拉取（上海市门店 48 款真实餐品）
- 顾客是独立决策的 NPC：有预算、有容忍度、会加购、会因缺货/排队/定价暴走
- 每局 7 天，结束产出**个性化省钱攻略**（券组合穷举优化）与经营战报
- 三种形态：CLI（`python -m game`）/ Web 在线玩（GitHub Pages）/ WorkBuddy Skill

定位：**游戏是钩子（传播），省钱攻略是本体（收藏）**。

## 二、开发时间线

| 阶段 | 时间 | 产出 |
|---|---|---|
| 立项调研 | 10/17 下午 | 赛事规则核实、竞品实证分析（GitHub API 拉取 Top 20 项目结构与 star）、三方案裁决 |
| v0.1 | 10/17 晚 | 经营引擎 + CLI + 名场面演示模式（commit ee741ff） |
| v0.2 | 10/17 深夜 | 省钱攻略生成器 + Skill 安装形态 + README 第一屏改造（commit afd21ed） |
| v0.3 | 10/18 凌晨 | MCP live 全链路：真实菜单/活动/券解析，mock/live 双模式（commit 5f75191） |
| 平衡修复 | 10/18 中午 | 菜单品类映射修复 + 备货模型重调（commit 704a87b） |
| Web 版 | 10/18 下午 | docs/ 单页应用上线 + Node 回归 + UI 冒烟测试（commit 4c38777） |

## 三、WorkBuddy 承担的工作

### 1. 市场与竞品调研（立项依据）

通过 GitHub API 对赛事排行榜 Top 20 项目做了实证分析，得出三个关键事实：

- 榜首 mcd-saver-strategist（当时 487★）是省钱精算类，日增约 21-66★；
- "游戏类仓库 star 率高"是伪命题——GitHub 全站 tycoon 类仓库天花板仅 70★；
- 榜单上经营游戏几近空白，同类最高 2★。

据此确定差异化路线：**游戏形态做传播钩子，Skill/攻略形态做收藏本体**。

### 2. 架构与裁决

对三个候选方案（A 经营游戏 / B 公路补给站 / C 麦门自习室）启用五人智囊团模式裁决（怀疑者/第一性原理/扩张者/局外人/执行者五视角独立分析 → 交叉质询 → 主席总结），选定 A 并明确改造方向。B、C 因"无垂直流量账号 + 地图合规成本 + MCP 内核薄"被否决。

### 3. 代码实现

- 全部 Python 代码（game/ 包、mcdmcp/ 客户端、skills/、tests/）由 WorkBuddy 编写；
- MCP 协议逆向：实测发现所有工具返回「markdown + 内嵌 JSON」，价格数据实际在 `query-meals` 返回的 `data.meals` 映射表中（`data.categories[].meals[]` 只是存根），据此重写客户端，一次调用拿全菜单；
- Web 版为 Python 引擎的忠实移植（docs/tycoon.js），同一套平衡参数双端对齐。

### 4. 测试与调参

- mock 回归：3 种子利润/口碑稳定性测试；
- live 端到端：真实菜单解析（48 款）、活动（30 条）、可领券（4 张）验证；
- 平衡调参：发现并按"建议备货"玩法会亏损（报废 ¥800+/日）后，用 5 种子 × 4 组参数网格实测，将备货模型从"按客流"改为"按成交推导"，双端利润 ¥4000-7400、口碑 58-82；
- Web UI：Node + DOM 桩全流程冒烟（开始→定价→营业→日报→战报→重开）。

### 5. 数据处理

- 数据全部来自真实链路：菜单 = MCP `query-meals` 实时拉取（含 53 款合并菜单快照 data/menu.game.json）；
- 成本价为游戏假设（市场价 55%），已在 README 中明确标注为假设；
- Token 安全：只从环境变量读取，不入任何文件。

## 四、关键决策记录（含被否决方案）

| 决策 | 选择 | 否决的选项 | 理由 |
|---|---|---|---|
| 项目形态 | 游戏钩子 + Skill 本体 | 纯省钱工具 | 榜上已有 100 个省钱 Skill，无差异度 |
| 顾客系统 | 离线语料（98 条吐槽） | 纯 LLM 顾客 | 无 API Key 也要能玩；LLM 作为增强项后续接入 |
| 菜单策略 | live 真实菜单 + 缺品类演示补充 | 纯演示菜单 / 纯 live | 保证五品类顾客模型完整，同时保住"真实"卖点 |
| Web 架构 | 多文件静态（零依赖） | 构建工具链 | GitHub Pages 直接托管，无构建步骤 |
| 攻略算法 | 确定性穷举 | LLM 生成 | 数字必须可信，品类约束保证演示诚实 |

## 五、数据与出处

- 赛事规则：官方仓库 M-China/mcd-developer-innovation-challenge（README / activityGuidelines.md / CONTEST_DECLARATION.md）
- MCP 文档：open.mcd.cn/mcp/doc；协议逆向结论见 MCP_INTEGRATION.md 实测备注
- 竞品数据：GitHub API 实时拉取（2026-10-17/18）
- 平衡参数：双端 5 种子网格实测（见 tests/ 与提交记录）

## 六、复现方式

```bash
git clone https://github.com/longtimecar/WorkBuddy-McDonald-tycoon-game.git
cd WorkBuddy-McDonald-tycoon-game
python -m game --demo        # 名场面演示
node tests/web_engine.test.js  # 引擎回归
node tests/ui_smoke.test.js    # UI 全流程冒烟
```
