<h1 align="center">Zcode-dispatch</h1>

<p align="center">
  <strong>ZCode 并行模型调度插件：把「该不该并发、用哪个模型、开几路、结论可不可信」固化成可复用的调度纪律。</strong>
</p>

<p align="center">
  主 Agent 只指挥，子 Agent 只干活——主上下文只进结论，不进过程噪音。
</p>

<p align="center">
  <a href="https://github.com/HACKED3056/zcode-dispatch-plugin/releases/latest"><img src="https://img.shields.io/github/v/release/HACKED3056/zcode-dispatch-plugin?style=flat&label=release&color=4D6BFE" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-4493F8?style=flat-square" alt="文档语言：中文">
</p>

<p align="center"><sub>独立的社区插件，与 ZCode 官方不存在隶属、合作、授权或背书关系。深度设计说明见 <a href="docs/DESIGN.md">docs/DESIGN.md</a>，长文介绍见<a href="https://blog.ss0t-hacked.top/2026/zcode-zcode-dispatch">作者博客</a>。</sub></p>

---

ZCode 有多档模型（重思考 / 均衡 / 极速 / 经 ListModels 可路由的任意模型）与两种并发原语（Agent 工具、CreateWorkflow），但不回答三个调度问题：**路由无依据、上下文单向污染、验收无纪律**。本插件用 9 个纯声明式文件（2 个代理定义、6 个命令、1 个技能）把这些问题固化成「评分 → 确认 → 派发 → 回流 → 总装」流程——零脚本、零 hooks、零运行时依赖。

## 快速开始

```text
1. 克隆本仓库 → ZCode 设置 → 插件市场 → 添加市场 → 本地目录 → 选仓库根目录 → 安装 Dispatch
2. 新开会话（技能/命令随会话启动加载；agent 定义下一条消息即可生效）
3. 说「并发处理这批文件」，或先跑 /dispatch:doctor 自检
```

装完说人话即可：**「并发把这 20 个文件翻译了」** → 四维评分推荐通道 → 向你确认模型与并发数 → 派发 → 回流汇总。

## 四档通道

| 通道 | subagent_type | 模型 | 默认并发 | 适用 |
| --- | --- | --- | --- | --- |
| flashx（默认） | `flashx-worker` | `new-provider/glm-5.3-flashx` | 4 | 大批量、轻推理、求速率 |
| flash（点名用） | `flash-worker` | `bigmodel-api/GLM-5.3-Flash` | 3 | 操作型并发，结论要求更稳 |
| heavy | `heavy-worker` | `bigmodel-api/GLM-5.3` | 2-4 | 多方案论证 / 逐文件审查 / 根因分析 |
| 动态工作流 | CreateWorkflow | 任意 ListModels ID | `max_concurrency` | 有依赖 / 分阶段 / 循环 / 大规模扇出 |

判据一句话：**工作流吃的是结构，不是难度**；四维都低的小任务主会话直接做，不派发。

## 命令

| 命令 | 作用 |
| --- | --- |
| `/dispatch:flashx\|flash\|heavy <任务> [并发数]` | 点名通道直接派发，跳过评分确认 |
| `/dispatch:route <档位> [并发数]` | 子代理档位偏好（工作区覆盖 → 全局兜底两层）；点名即回答 |
| `/dispatch:collate [抽查比例%]` | 群集报告分级复核：双轨互证 / P0·P1 全查 / flashx P2 抽查 ≥30% / 账本沉淀 |
| `/dispatch:doctor` | 六项体检：缓存一致 / 版本一致 / 代理定义 / 模型在列 / 指向有效 / 触发词在位 |

派发确认纪律：**逐次必问，点名即回答**——模型与并发数都点名才跳过确认；「以后都这样」只改默认推荐项。

## 文档

| 想了解 | 去哪 |
| --- | --- |
| 设计动机、核心概念、架构、设计决策 D1–D7 | [docs/DESIGN.md](docs/DESIGN.md) |
| 已知限制、常见问题 | [docs/FAQ.md](docs/FAQ.md) |
| 版本历史（五维度） | [dispatch/CHANGELOG.md](dispatch/CHANGELOG.md) |
| 改动 SOP / 平台约束 | [dispatch/MAINTENANCE.md](dispatch/MAINTENANCE.md) |

## 从 v0.3.4 / subroute 升级

1.0.0 合并了 subroute 插件（/route 偏好 + /collate 复核）：偏好与账本文件路径完全一致，数据无缝沿用；**升级后请停用/卸载 subroute**，避免双注册。更新走 插件管理 → dispatch → 更新。

## License

[MIT](LICENSE)
