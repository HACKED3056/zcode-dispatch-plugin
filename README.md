<h1 align="center">Zcode-dispatch</h1>

<p align="center">
  <strong>ZCode 的「并行调度员」——一句人话，唤起一群 AI 分身替你干活，你只收最终结果。</strong>
</p>

<p align="center">主 Agent 只指挥，子 Agent 只干活：主上下文只进结论，不进过程噪音。</p>

<p align="center">
  <a href="https://github.com/HACKED3056/zcode-dispatch-plugin/releases/latest"><img src="https://img.shields.io/github/v/release/HACKED3056/zcode-dispatch-plugin?style=flat&label=release&color=4D6BFE" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-4493F8?style=flat-square" alt="文档语言：中文">
</p>

<p align="center">
  <a href="#这是什么">这是什么</a> •
  <a href="#特性">特性</a> •
  <a href="#安装">安装</a> •
  <a href="#命令">命令</a> •
  <a href="#四档通道">四档通道</a> •
  <a href="#文档">文档</a>
</p>

<p align="center"><sub>独立的社区插件，与 ZCode 官方不存在隶属、合作、授权或背书关系。深度设计说明见 <a href="docs/DESIGN.md">docs/DESIGN.md</a>，长文介绍见<a href="https://blog.ss0t-hacked.top/2026/zcode-zcode-dispatch">作者博客</a>。</sub></p>

---

## 这是什么？

ZCode 给了你多档模型（重思考 / 均衡 / 极速 / 任意可路由模型）与两种并发原语（Agent 工具、CreateWorkflow），但没回答四个调度问题：**什么时候该并发？开几路？用快档还是深档？干完的活谁验收？**——这个插件把答案固化成「评分 → 确认 → 派发 → 回流 → 总装」一套流程：9 个声明式文件 + 一道确认硬闸 hook，除硬闸外零脚本、零运行时依赖。

你只要说一句人话：

```text
你：「并发把这 20 个文件翻译了」
   │
   ├─ ① 评分 ─ 四维判断（散乱度 / 依赖 / 规模 / 难度）→ 给出建议：flashx 快速档 × 4 路
   ├─ ② 确认 ─ 弹一次问，你点同意；你已点名模型 + 数量则免问
   ├─ ③ 派发 ─ 4 个子代理并行开工，过程输出不进主对话
   └─ ④ 回流 ─ 各自只回传精炼结论 → 重要结论全查、次要抽查 → 总装成一份清单交给你
```

全程你的主对话只多了几行汇总，而不是 20 份过程日志。

## 特性

### 评分先行，不瞎并发

该不该并发、开几路，由四维评分（散乱度 / 依赖 / 规模 / 难度）替你判断，给出「档位 × 路数」建议；四维都低的小任务直接主会话做，不浪费分身。

### 过程噪音不进主对话

子代理只在结束时回传精炼结论（结论 + 产物路径），过程留在它们各自的上下文里——主对话上下文不再被刷爆。

### 干完必须过验收

回流走分级复核：P0/P1 重要结论全查，快速档（flashx）的次要结论按比例抽查（默认 ≥30%），问题标级汇总，账本沉淀可查。

### 确认硬闸兜底

「逐次必问，点名即回答」由 PreToolUse hook 硬执行：没经你确认的档位派发会被直接拦截——模型忘了问也派不出去。

### 七项自检

`/dispatch:doctor` 一条命令体检安装健康度：缓存一致性、版本一致、代理定义、模型在列、指向有效、触发词在位、外部依赖与残留。

## 安装

```text
1. 克隆本仓库 → ZCode 设置 → 插件市场 → 添加市场 → 本地目录 → 选仓库根目录 → 安装 Dispatch
2. 新开会话（技能 / 命令随会话启动加载；agent 定义下一条消息即可生效）
3. 装完说人话即可：「并发处理这批文件」，或先跑 /dispatch:doctor 自检
```

从 v0.3.4 / subroute 升级：1.0.0 已合并 subroute（偏好与账本无缝沿用），**升级后请停用或卸载 subroute** 避免双注册；日常更新走 插件管理 → dispatch → 更新。

## 命令

| 命令 | 作用 |
| --- | --- |
| `/dispatch:flashx\|flash\|heavy <任务> [并发数]` | 点名通道直接派发，跳过评分与确认 |
| `/dispatch:route <档位> [并发数]` | 记录档位偏好，作为确认问的默认推荐项 |
| `/dispatch:collate [抽查比例%]` | 对群集报告跑分级复核流水线 |
| `/dispatch:doctor` | 七项体检 |

自然语言触发：消息里出现「并发」「并行」「分工」「群集」「多个AI同时干」等字样，技能自动接管调度流程。

## 四档通道

| 通道 | subagent_type | 模型 | 默认并发 | 适用 |
| --- | --- | --- | --- | --- |
| flashx（默认） | `flashx-worker` | `new-provider/glm-5.3-flashx` | 4 | 大批量、轻推理、求速率 |
| flash（点名用） | `flash-worker` | `bigmodel-api/GLM-5.3-Flash` | 3 | 操作型并发，结论要求更稳 |
| heavy | `heavy-worker` | `bigmodel-api/GLM-5.3` | 2-4 | 多方案论证 / 逐文件审查 / 根因分析 |
| 动态工作流 | CreateWorkflow | 任意 ListModels ID | `max_concurrency` | 有依赖 / 分阶段 / 循环 / 大规模扇出 |

判据一句话：**工作流吃的是结构，不是难度**；四维都低的小任务主会话直接做，不派发。

## 文档

| 想了解 | 去哪 |
| --- | --- |
| 设计动机、核心概念、架构、设计决策 D1–D9 | [docs/DESIGN.md](docs/DESIGN.md) |
| 已知限制、常见问题 | [docs/FAQ.md](docs/FAQ.md) |
| 版本历史（五维度） | [dispatch/CHANGELOG.md](dispatch/CHANGELOG.md) |
| 改动 SOP / 平台约束 | [dispatch/MAINTENANCE.md](dispatch/MAINTENANCE.md) |

## License

[MIT](LICENSE)
