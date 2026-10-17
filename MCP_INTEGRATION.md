# MCP_INTEGRATION.md

本项目与麦当劳中国官方 MCP 的集成说明。

## 1. 使用的 MCP Server

| 项 | 值 |
|---|---|
| 名称 | 麦当劳中国 MCP Server |
| 接入地址 | `https://mcp.mcd.cn` |
| 传输协议 | Streamable HTTP（`Authorization: Bearer ${MCD_MCP_TOKEN}`） |
| 官方仓库 | https://github.com/M-China/mcd-mcp-server |
| 官方文档 | https://open.mcd.cn/mcp/doc |

## 2. 实际使用的 Tool

| Tool | 在游戏中的作用 |
|---|---|
| `query-nearby-stores` | 按城市+关键词查门店，确定“我的店”所在商圈（`searchType=2` 时 city 与 keyword 必填） |
| `query-meals` | **核心数据源**：一次返回全菜单——`data.categories[].meals[]` 给分类和餐品 code，`data.meals` 映射表给名称/现价/原价/优惠类型 |
| `query-meal-detail` | 查询餐品套餐组成与可替换选项（游戏内“套餐组合”机制的可选增强） |
| `calculate-price` | 商品价格计算（商品金额/优惠/应付总价），用于校准游戏“市场价”与玩家定价的收益模型 |
| `campaign-calendar` | 麦当劳中国当月营销活动日历，是游戏**事件池的现实依据**（会员日、主题活动等均有现实原型） |
| `available-coupons` / `auto-bind-coupons` | 麦麦省优惠券，驱动游戏内顾客“薅券”行为与省钱攻略的券池 |
| `list-nutrition-foods` | 餐品营养信息，游戏内“健康套餐”成就的数据来源 |
| `now-time-info` | 获取当前时间，用于活动日历对齐与每日战报时间戳 |

## 3. 调用流程

```
游戏启动
  ├─ live 模式（配置 MCD_MCP_TOKEN）
  │    query-nearby-stores ──→ storeCode（真实门店）
  │    query-meals ──→ 48 款真实菜单/现价 ──→ 游戏经济系统基础价（1 次调用拿全菜单）
  │    campaign-calendar ──→ 当月活动 ──→ 注入事件池
  │    available-coupons ──→ 真实可领券 ──→ 省钱攻略券池
  └─ mock 模式（无 Token）
       data/menu.snapshot.json 演示快照 ──→ 同样的经济系统
玩家每日决策（定价 / 备货 / 营销）
  └─ 经营引擎模拟客流与顾客决策
       └─ 日结算 + 口碑演化 + 省钱攻略 + 战报图（传播素材）
```

> 实测备注：`query-meals` 的 `data.categories[].meals[]` 只含 `{code, tags}` 存根，
> 价格信息在 `data.meals` 以 code 为键的映射表中；所有工具返回均为「markdown 说明 + 内嵌 JSON」，
> 客户端用括号配平提取 JSON（见 `mcdmcp/client.py::_extract_json`）。

## 4. 业务价值

- **真实数据驱动游戏经济**：菜单、价格、活动不是编造的，玩家面对的是麦当劳中国真实的商品世界；
- **离线可玩兜底**：无 Token 用户用内置演示快照获得完整玩法，MCP 故障/限流不中断游戏；
- **活动日历即 DLC**：官方每月营销活动自动成为游戏内容，游戏不需要人工更新事件库。

## 5. 真实性对照表（诚实工程）

| 数据 | 来源 | 说明 |
|---|---|---|
| 菜单与价格 | live = MCP 实时；mock = `data/menu.snapshot.json` | 快照为演示数据，结构对齐官方返回 |
| 营销活动事件 | 现实原型来自 `campaign-calendar` | 游戏化效果数值为设计假设 |
| 顾客行为/吐槽 | 游戏机制 + LLM/离线语料 | 与麦当劳官方无关的虚构顾客 |
| 客流/成本/口碑模型 | 游戏设计参数 | 经营模拟的简化模型，非真实经营数据 |

## 6. 限流与容错

- 官方限流 600 次/分钟；游戏对 MCP 的调用集中在启动阶段，正常游玩不触限；
- 任何 MCP 调用失败自动回落演示快照，游戏不中断（README 已注明"演示模式"）。
