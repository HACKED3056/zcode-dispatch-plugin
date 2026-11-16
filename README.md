# dispatch

ZCode 并行模型调度插件：把「该不该并发、用哪个模型、开几路、结论可不可信」固化为可复用的调度纪律。

[![Version](https://img.shields.io/badge/version-0.3.4-blue)](#版本历史)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#许可证)
[![Deps](https://img.shields.io/badge/runtime%20deps-0-success)](#架构)
[![Channels](https://img.shields.io/badge/%E9%80%9A%E9%81%93-4%20%E6%A1%A3-blueviolet)](#通道)

---

## 目录

- [动机](#动机)
- [核心概念](#核心概念)
- [通道](#通道)
- [架构](#架构)
- [前置要求](#前置要求)
- [安装](#安装)
- [使用](#使用)
- [命令参考](#命令参考)
- [设计决策](#设计决策)
- [项目结构](#项目结构)
- [已知限制](#已知限制)
- [贡献](#贡献)
- [兼容性](#兼容性)
- [版本历史](#版本历史)
- [许可证](#许可证)

---

## 动机

ZCode 提供多档模型（重思考 GLM-5.3、均衡 GLM-5.3-Flash、极速 GLM-5.3-FlashX、经 ListModels 可路由的任意模型）与两种并发原语（Agent 工具、CreateWorkflow）。宿主不回答的是调度问题：

1. **路由无依据。** 该不该并发、用哪个模型、开几路，没有评分标准时只能临场拍脑袋——不并发则慢，乱并发则有依赖的子任务互相踩踏。
2. **上下文单向污染。** 子代理的过程输出（读文件、跑命令、试错）若全量回流，主上下文被原始转储挤占，长任务后期质量下降。
3. **验收无纪律。** 快模型的结论偏浅、失败被静默重试、任务越拆越发散，没有统一的复核与收敛规则。

本插件以纯声明式文件（2 个代理定义、4 个命令、1 个技能）把上述决策固化为「评分 → 确认 → 派发 → 回流 → 总装」流程。目标读者：配置了多个 provider、需要在 ZCode 中做受控并发的用户。

## 核心概念

理解以下三者的关系，是正确使用本插件的前提。

### 并发 ≠ 工作流

```
Agent 并发  = 同一回复内多路派发，子任务互不依赖
动态工作流  = 编排逻辑：依赖、分阶段、失败换档重试、大规模扇出
```

判据：**工作流吃的是结构，不是难度。** 有结构（下一步的输入来自上一步的输出）用 Agent 并发会卡在主会话中转；无结构上工作流是白付启动成本（写脚本 + 类型检查 + 后台运行）。

### 指挥官 ≠ 执行者

主 Agent 只做四件事：拆解、派发、验收、总装，不亲手做子任务。子 Agent 吃掉全部过程噪音，以固定格式回流：

```
结论 + 证据指针（路径:行号）+ 遗留不确定点
```

### 三个正交的决策

| 决策 | 谁拍板 | 机制 |
| --- | --- | --- |
| 通道（用哪个模型） | 评分推荐 + 用户确认 | AskUserQuestion，推荐项排第一 |
| 并发数 | 用户确认 | 按档位区间生成 下限/中位/上限 三选项，推荐下限 |
| 思考等级 | 仅工作流档 | `subagent_model` 加 `$low/$high/$max` |

三者互不依赖，可任意组合。主会话模型不在确认范围——由用户在模型选择器自选。

### 派发闭环

```
思考 ──► 派发 ──► 回流 ──► 再思考 ──► ……
                                ▲
                回流上限 2 轮，第 3 轮必须收敛交付
```

## 通道

| 触发方式 | subagent_type | 模型 | 默认并发（区间） | 回退 |
| --- | --- | --- | --- | --- |
| 默认并发 / flashx / 快速完成 / 速度优先 / 大批量 | `flashx-worker` | `new-provider/glm-5.3-flashx`（thoughtLevel low） | 4（4-8） | 无；缺失时提示检查，不静默降级 |
| flash / 要更稳结论的操作并发 | `flash-worker` | `bigmodel-api/GLM-5.3-Flash` | 3（3-6） | `general-purpose`（已被 agents-state.json 固定为同模型） |
| 5.3 / 分身 / 高强度深挖 | `heavy-worker` | `bigmodel-api/GLM-5.3` | 2-4 | 无 |
| 工作流；点名其他模型；任务有依赖/循环/分阶段 | CreateWorkflow | 任意 ListModels ID（`subagent_model` 指定） | `max_concurrency` 硬限 | — |

任务画像 → 通道：

| 画像 | 通道 |
| --- | --- |
| 大批量、轻推理、求速率；图片输入、联网搜索 | flashx |
| 操作型并发，结论要求更稳 | flash |
| 多方案论证 / 逐文件审查 / 根因分析 / 攻防两条线 | heavy |
| A 群跑完再拆 B、失败自动换档重试、几百文件扇出 | 工作流 |
| 四维都低的小任务 | 主会话直接做，不派发 |

## 架构

### 调度链路

```
用户消息（触发词「并发/并行/分工/群集」│ 点名 │ 命令）
   │
   ├─ 命令 ────────────► 已点名通道，跳过评分确认 ─┐
   ├─ 自然语言 ──► swarm 技能                      │
   │              ├─ 四维评分 ──► 推荐通道          │
   │              └─ AskUserQuestion 确认 ─────────┤
   ▼                                               ▼
 主会话拆解（切分是思考的产物，互不依赖才并行）
   │  同一条回复内发出全部 Agent 调用（派发消息自包含）
   ▼
 子代理执行（过程噪音留在子上下文）
   │  回流：结论 + 证据指针 + 遗留不确定点
   ▼
 主模型验收总装（逐路过目 / 交叉验证 / 抽样复核）
```

### 四维评分

| 维度 | 锚点 |
| --- | --- |
| 散乱度 | 能否互不依赖地同时开工 |
| 依赖度 | 下一步的输入是否来自上一步的输出 |
| 规模 | 估出的子任务数，≥5 记高 |
| 思考难度 | 是否需要重推理 |

| 评分组合 | 推荐 |
| --- | --- |
| 有结构（依赖/分阶段/循环） | 动态工作流 |
| 散乱独立 + 操作型 | flashx（默认通道） |
| 纯难无结构 | heavy 分身 |
| 都低 | 主会话直接做 |

任一维度拿不准取更保守的一档，连同理由放进确认问。

### 声明式集成

`plugin.json` 仅映射 `agents/`、`commands/`、`skills/` 三个目录：零脚本、零 hooks、零 MCP、零运行时依赖。定义随会话启动加载为快照。

## 前置要求

| 依赖 | 用途 |
| --- | --- |
| ZCode Agent 工具 + CreateWorkflow | 并发原语 |
| `bigmodel-api` provider | flash / heavy 通道模型 |
| `new-provider` 中转站 | flashx 通道模型（需在 ListModels 在列且未禁用） |
| `~/.zcode/v2/agents-state.json` | general-purpose 固定为 GLM-5.3-Flash（flash 回退依据） |
| `~/.zcode/AGENTS.md` 触发条款（可选） | 强化逐次确认纪律；无它时技能仍可按描述触发 |

## 安装

### 1. 本地市场

```text
克隆本仓库 → ZCode 设置 → 插件市场 → 添加市场 → 本地目录 → 选仓库根目录 → 安装 Dispatch
```

### 2. 手动放置

把 `dispatch/` 复制进工作区 `plugins/` 并在 `marketplace.json` 登记。

> **会话快照**
> 代理定义与技能均为会话启动快照，安装、更新、改动后需**新开会话**生效。

## 使用

### 触发的四种方式

| 方式 | 示例 | 评分与确认 |
| --- | --- | --- |
| 触发词 | 「并发处理这批文件」 | 唤醒技能，评分 + 确认 |
| 点名 | 「用 flashx 4 路翻译 docs/」 | 跳过确认，直接派发 |
| 命令 | `/dispatch:flashx <任务> 6` | 跳过评分与确认 |
| 体检 | `/dispatch:doctor` | 只读检查 |

### 一次完整调用

```text
用户：/dispatch:flashx 把 docs/ 下 20 篇英文笔记翻译成中文 6
  → 拆 6 路互不依赖的翻译任务
  → 同一条回复内并行派发，每路消息自包含
  → 各路回流「结论 + 产物路径」
  → 主模型抽查术语一致性后汇总
```

### 派发消息四要素

每条派发消息自包含：**目标、绝对路径、产物要求、完成标准**，不依赖对话上文。

### 验收纪律

- 逐路交代结论与产物路径；冲突摆证据；失败如实报。
- flashx 关键结论（数字/事实/路径）逐条过目，抽 1-2 条改派 flash 或 5.3 复核，不一致以复核为准并写进汇报。
- 子任务失败可同档或高档重试一次；连续失败升级用户，不静默重试到成功。

## 命令参考

### `/dispatch:flash|flashx|heavy <任务> [并发数]`

| 命令 | 默认并发 | 专属纪律 |
| --- | --- | --- |
| `flash` | 3 | 子任务必须互不依赖；偶发 ListModels 验证 `[current]` |
| `flashx` | 4 | 关键结论复核（见验收纪律） |
| `heavy` | 2-4 维度 | 按「维度」拆而非「份数」；总装交叉验证，裁决不了的升级用户 |

### `/dispatch:doctor`

| # | 检查项 | 方法 |
| --- | --- | --- |
| 1 | 源码↔缓存一致 | installPath 指向目录与源码 `diff -r` |
| 2 | 版本一致 | plugin.json / marketplace.json / installed_plugins.json 三处 |
| 3 | 代理定义完整 | 中转站代理必须有 `thoughtLevel:` 字段 |
| 4 | 模型在列 | ListModels 含三个路由 ID 且未禁用 |
| 5 | 指向有效 | installPath 存在且含 `.zcode-plugin/plugin.json` |
| 6 | 触发词在位 | AGENTS.md 含「并发」「四维评分」字样 |

全程只读；修复优先走正规路径（见 MAINTENANCE.md），不手改缓存。

## 设计决策

### 为何 0.3.4 把确认从「会话沿用」收紧为「逐次必问」

0.3.3 的行为是确认一次后本会话沿用。实测暴露问题：默认档在长会话中被静默固化，后续派发不再经过用户——并发花的是真金白银，路由决策不应因「早前确认过」而免检。0.3.4 改为每次派发前必问；唯一例外是**当前消息已点名**（点名即回答，重复问是打扰）；「以后都这样」只能改默认推荐项，不免除逐次询问。

### 为何默认通道从 flash 换成 flashx

高频场景是「大批量、轻推理、求速率」的操作型并发，flashx（基元律动 TokenRhythm，thoughtLevel low）单位成本与延迟更低；flash 留给点名要更稳结论时。0.3.4 同步把未指定模型的默认并发从 3 路（flash）调整为 4 路（flashx）。

### 为何 flashx 结论强制复核

flashx 速率优先、推理浅，汇报里的数字/事实/路径不可直接采信。纪律要求抽 1-2 条关键结论改派 flash 或 5.3 复核，不一致以复核为准并写进汇报——把「快」的收益与「浅」的风险显式对冲。

### 为何回流上限 2 轮

无上限的「回流→再拆」会发散：每轮拆出新的不确定点，任务永不收敛。上限 2 轮 + 第 3 轮强制收敛（未决项如实标注）把发散风险变成有界的延迟。

### 为何不内置 flash-worker

`~/.zcode/v2/agents-state.json` 已把 general-purpose 固定为 GLM-5.3-Flash。再内置一份 flash-worker 意味着同一模型两处定义、两处维护；命令里「优先 flash-worker，缺则回退 general-purpose」让两者等效，避免重复。

### 为何中转站代理必须写 `thoughtLevel:`

`$low` 后缀只在动态工作流 `subagent_model` 里生效，agent 文件里不认。中转站（new-provider 等）代理若不显式写 `thoughtLevel:`，派发时报 `reasoning-level-missing`。这是平台约束，只能规避，不能修复。

### 为何不做硬并发限流

Agent 工具没有并发硬上限（平台事实），插件只给纪律建议值（flash 3-6 / flashx 4-8 / heavy 2-4）；唯一硬闸是工作流的 `max_concurrency`。如实记录在 MAINTENANCE.md 的平台约束里，不假装能修。

## 项目结构

```
zcode-dispatch-plugin/
├── README.md               本文档
├── REPORT.md               软件工程报告（问题/需求/设计/场景/追溯）
├── LICENSE                 MIT
├── marketplace.json        本地市场清单
└── dispatch/
    ├── .zcode-plugin/plugin.json
    ├── agents/             flashx-worker / heavy-worker
    ├── commands/           flash / flashx / heavy / doctor
    ├── skills/swarm/       评分·路由·纪律·排障
    ├── README.md           使用说明
    └── MAINTENANCE.md      改动 SOP / 应急路径 / 平台约束
```

## 已知限制

- **会话快照。** 一切定义改动需新会话生效，当次救不了急。
- **doctor 内嵌本机路径。** 检查项 1/5 的源码与缓存路径写死于命令文件，跨机使用需按自身环境调整。
- **触发依赖 AGENTS.md 条款。** doctor 检查项 6 校验的是本机 AGENTS.md；其他用户无此条款时技能仍可按描述触发，但逐次确认纪律的强制性减弱。
- **flashx 通道依赖中转站。** `new-provider` 不在列或被禁用时该通道不可用，doctor 检查项 4 报警。
- **并发无硬上限。** 只有纪律建议值；硬闸仅工作流 `max_concurrency`。

## 贡献

见 [dispatch/MAINTENANCE.md](dispatch/MAINTENANCE.md)。核心要求：

1. 改源码，不改缓存；版本号在 plugin.json 与 marketplace.json 两处同步 +1
2. 更新走 ZCode 设置 → 插件管理 → 更新，不手改 installed_plugins.json（应急路径除外）
3. 命令与技能改动需在真实会话验证派发行为（含 ListModels `[current]` 抽查）

## 兼容性

| 环境 | 状态 |
| --- | --- |
| ZCode（Agent 工具 + CreateWorkflow + AskUserQuestion） | 已验证 — Windows 11 / GLM-5.3 主会话 / bigmodel-api + new-provider 双 provider |
| 单 provider 安装 | 可安装；flash / heavy 可用，通道分层意义有限 |
| 无中转站 provider | flashx 通道不可用，doctor 检查项 4 报警 |

## 版本历史

| 版本 | 变更 |
| --- | --- |
| 0.3.4 | 默认通道 flash → flashx（未指定模型默认 4 路）；确认政策收紧为逐次必问（点名即回答为唯一例外）；并发数选项改为区间 下限/中位/上限 三档，推荐下限（flash 3、flashx 4、heavy 2） |
| 0.3.3 | 当前安装缓存版本；技能与确认流程基线 |

> 变更依据：0.3.4 源码与 0.3.3 安装缓存的 `diff -r`（差异共三处：`flashx-worker.md`、`skills/swarm/SKILL.md`、版本号）。

## 许可证

[MIT](LICENSE)
