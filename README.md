# Zcode-dispatch

ZCode 并行模型调度插件：把「该不该并发、用哪个模型、开几路、结论可不可信」固化为可复用的调度纪律。

> 主 Agent 只指挥，子 Agent 只干活——主上下文只进结论，不进过程噪音。

## 快速开始

```text
1. 克隆本仓库 → ZCode 设置 → 插件市场 → 添加市场 → 本地目录 → 选仓库根目录 → 安装 Dispatch
2. 新开会话（定义随会话启动加载，热改不生效）
3. 说「并发处理这批文件」，或先跑 /dispatch:doctor 自检
```

装完说人话即可：**「并发把这 20 个文件翻译了」** → 四维评分推荐通道 → 向你确认模型与并发数 → 派发 → 回流汇总。

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
- [插件源码一览](#插件源码一览)
- [已知限制](#已知限制)
- [常见问题](#常见问题)
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


### `/dispatch:route <档位> [并发数]`

| 用法 | 行为 |
| --- | --- |
| 空 / `off` | 查看 / 清除偏好（工作区 `.zcode/subroute.json` 优先，全局 `~/.zcode/subroute/state.json` 兜底） |
| `<档位> [并发数]` | 点名即回答：本次派发直接生效；偏好仅作确认问默认推荐项，不免除逐次询问 |

### `/dispatch:collate [抽查比例%]`

群集报告分级复核：双轨互证自动确认、P0/P1 全查逐行、轨道矛盾强制定谳、flashx 轨 P2 抽查 ≥30% 且 ≥3 条、heavy 轨 P2 单轨采信；终判回写账本 `.zcode/subroute-collations.json`。
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

七条核心决策，按 背景 → 决策 → 被否决方案 组织；标注版本号的为该版本的变更项。

### D1 · 派发前逐次确认，点名即视为回答

**背景**：并发消耗真实额度，路由决策不应因「早前确认过」而免检。
**决策**：每次派发前必须 AskUserQuestion 确认模型档与并发数；用户当前消息已点名时跳过——点名即回答，重复问是打扰；「以后都这样」仅修改默认推荐项，不免除逐次询问。
**被否决方案**：会话沿用（0.3.3 行为，确认一次后本会话不再问）——实测默认档在长会话中被静默固化，后续派发绕过用户，0.3.4 废弃。

### D2 · 默认通道 flashx，flash 保留给点名场景

**背景**：高频场景是「大批量、轻推理、求速率」的操作型并发，对单位成本与延迟敏感。
**决策**：未点名模型时派 flashx（基元律动 TokenRhythm，thoughtLevel low），默认 4 路；flash（默认 3 路）仅在点名或要求更稳结论时使用。
**被否决方案**：flash 作默认通道（0.3.3 行为）——成本与延迟偏高，与高频场景不匹配，0.3.4 对调。

### D3 · flashx 关键结论强制交叉复核

**背景**：flashx 速率优先、推理浅，汇报中的数字/事实/路径不可直接采信。
**决策**：影响决策的关键结论逐条过目，抽 1-2 条改派 flash 或 5.3 复核；不一致以复核为准并写进汇报。
**被否决方案**：直接采信——速率收益以结论风险为代价；全量复核——成本抵消并行收益。取抽样折中。

### D4 · 回流两轮上限，第三轮强制收敛

**背景**：无上限的「回流→再拆」会发散——每轮产生新的不确定点，任务永不收敛。
**决策**：闭环最多 2 轮回流再思考，第 3 轮必须收敛交付，未决项如实标注。
**被否决方案**：无限迭代——发散风险不可控；单轮硬停——复杂任务确需二次拆解，一轮太紧。

### D5 · flash-worker 不内置，复用固定后的 general-purpose

**背景**：`~/.zcode/v2/agents-state.json` 已把 general-purpose 固定为 GLM-5.3-Flash。
**决策**：命令层「优先 flash-worker，缺则回退 general-purpose」，两者等效；本插件只定义 flashx-worker 与 heavy-worker。
**被否决方案**：内置 flash-worker 定义——同一模型两处定义、两处维护，且与本机固定配置可能漂移。

### D6 · 中转站代理显式声明 `thoughtLevel:`

**背景**：`$low` 后缀只在动态工作流 `subagent_model` 里生效，agent 文件不认。
**决策**：`new-provider` 等自定义 provider 的代理定义必须与 `model:` 并列写 `thoughtLevel:`（如 `thoughtLevel: low`），缺失时派发报 `reasoning-level-missing`。
**性质**：平台约束的规避项，不是可修复缺陷。

### D7 · 并发不限流，只给纪律区间

**背景**：Agent 工具没有并发硬上限，纯声明式插件没有运行时强制点。
**决策**：给纪律建议区间 flash 3-6 / flashx 4-8 / heavy 2-4；唯一硬闸是工作流的 `max_concurrency`。
**被否决方案**：插件内限流——无执行点，假装能修不如如实记录（见 MAINTENANCE.md 平台约束）。

## 项目结构

```
zcode-dispatch-plugin/
├── README.md               本文档（含全部源码内嵌展示）
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

## 插件源码一览

插件本体共 8 个声明式文件（约 21 KB，零脚本、零运行时代码），全部源码内嵌如下，点开即读。仓库同时保留 `dispatch/` 目录原件供安装使用。

<details>
<summary><strong><code>.zcode-plugin/plugin.json</code></strong> · 插件清单</summary>

```json
{
  "name": "dispatch",
  "version": "0.3.4",
  "description": "Parallel model dispatch in agent-workflow mode: the main agent commands, subagents execute and report back. Tasks are scored on fragmentation/dependency/scale/difficulty to recommend a channel: Flash pool, FlashX speed batches, heavy workers, or dynamic workflows targeting any model (cross-provider) with per-subagent reasoning levels. Model/level/concurrency confirmed with the user before dispatch.",
  "description_i18n": {
    "en": "Parallel model dispatch in agent-workflow mode: main agent commands, subagents execute and report back. Tasks are scored on fragmentation/dependency/scale/difficulty to recommend one of four channels: Flash pool, FlashX speed batches, heavy workers, or dynamic workflows for any cross-provider model.",
    "zh-CN": "并行模型调度（Agent 工作流模式）：主 Agent 指挥、子 Agent 执行回传。先按散乱度/依赖度/规模/思考难度四维评分推荐通道：flash 群集、flashx 快速批、heavy 分身、动态工作流（跨路由任意模型+等级控制）；派发前确认模型/等级/并发数。"
  },
  "author": { "name": "HACKED" },
  "license": "MIT",
  "agents": "agents",
  "commands": "commands",
  "skills": "skills"
}
```

</details>

<details>
<summary><strong><code>agents/flashx-worker.md</code></strong> · 极速执行代理（默认并发档）</summary>

```markdown
---
name: flashx-worker
description: 快速执行子代理，固定运行 GLM-5.3-FlashX（基元律动 TokenRhythm，速度优先，支持图片输入与联网搜索）。默认并发档：未点名模型的并发默认派它；点名 flashx / 快速完成 / 速度优先时也派它；支持图像任务。适合大批量、轻推理、求速率的操作并行。
color: cyan
model: new-provider/glm-5.3-flashx
thoughtLevel: low
---
你是快速执行子代理（GLM-5.3-FlashX）。任务已被主模型拆解，直接动手做完，速度优先：不纠结长推理，先给出可用结果。汇报精炼——结论 + 产物路径 + 明显风险点；拿不准的标注假设。遇到明显超出能力或需要深推理的子问题，如实上报让主模型改派，不要硬扛。
```

</details>

<details>
<summary><strong><code>agents/heavy-worker.md</code></strong> · 高强度分身代理</summary>

```markdown
---
name: heavy-worker
description: 高强度执行分身，固定运行 GLM-5.3（与主模型同级的重思考模型）。用于把硬任务按维度拆开并行深挖——多方案对比论证、逐文件深度审查、复杂推理、根因分析、攻防两条线。主模型负责拆解与总装，分身各自产出带证据的自包含结论。纯机械操作型任务不要派给它，留给 flash 群集。
color: red
model: bigmodel-api/GLM-5.3
---
你是高强度执行分身（GLM-5.3），与主模型同级、同样能做深度思考。你接到的子任务已经被主模型拆解成一个独立维度，职责是把这个片段做深做透，而不是泛泛而谈。

工作准则：
- 只做分派给你的维度，不要越界替其他分身干活，也不要重新规划总体方向。
- 结论必须带证据：引用文件路径与行号、命令输出、数据；没有证据的断言明确标注为推测。
- 产出自包含：主模型只看你的汇报做总装，写清背景假设、推导链、最终结论、遗留不确定点。
- 遇到比预期更深的问题，如实上报，不要自行扩任务。
```

</details>

<details>
<summary><strong><code>commands/flashx.md</code></strong> · <code>/dispatch:flashx</code> 命令</summary>

```markdown
---
description: 把速度优先的批量任务并行铺给 GLM-5.3-FlashX（中转站 TokenRhythm，thoughtLevel low）执行并汇总，结论需复核。
argument-hint: "<任务描述> [并行数量，默认4]"
---

把下面的任务拆成多个互不依赖的子任务，并行派发给 flashx 子代理执行，最后汇总：

$ARGUMENTS

调用本命令即视为已点名 flashx 通道与默认并发（4 路），无需再做四维评分与派发前确认；需要其他通道请用自然语言触发 swarm 技能。

调度规则：

1. 未指定数量时拆 4 路（建议区间 4-8）；子任务之间必须互不依赖，有依赖的留在主会话串行。
2. 并行派发：在同一条回复里对每个子任务各发起一次 Agent 工具调用（并行执行），subagent_type 用 `flashx-worker`（`new-provider/glm-5.3-flashx`，thoughtLevel low）；本会话若没有该类型，提示用户检查 `~/.zcode/agents/flashx-worker.md` 与 dispatch 插件，不要静默降级到其他类型。
3. 每条派发消息自包含：目标、涉及文件/URL 的绝对路径、期望产物、完成标准；支持图片输入与联网搜索的任务可放心交给它。
4. 汇总逐路给出结论与产物路径；flashx 求速率结论偏浅——影响决策的关键结论（数字/事实/路径）逐条过目，抽 1-2 条改派 flash 或 5.3 复核，不一致以复核为准并写进汇报。
5. 偶发验证：任选一路子代理调用 ListModels，其 `[current]` 应为 `new-provider/glm-5.3-flashx`；不符则中止汇总并提示检查代理文件的 `thoughtLevel` 字段。
```

</details>

<details>
<summary><strong><code>commands/flash.md</code></strong> · <code>/dispatch:flash</code> 命令</summary>

```markdown
---
description: 把操作型任务并行铺开到 flash 子代理群集（GLM-5.3-Flash）执行并汇总。
argument-hint: "<任务描述> [并行数量，默认3]"
---

把下面的任务拆成多个互不依赖的子任务，并行派发给 flash 子代理群集执行，最后汇总：

$ARGUMENTS

调用本命令即视为已点名 flash 通道与默认并发（3 路），无需再做四维评分与派发前确认；需要其他通道请用自然语言触发 swarm 技能。

调度规则：

1. 未指定数量时拆 3 路；子任务之间必须互不依赖，有依赖关系的步骤留在主会话串行做，不要强行并行。
2. 并行派发：在同一条回复里对每个子任务各发起一次 Agent 工具调用（并行执行），subagent_type 优先用 `flash-worker`（GLM-5.3-Flash）；本会话若没有该类型则用 `general-purpose`（已被 agents-state.json 固定为 GLM-5.3-Flash）。
3. 每条派发消息必须自包含：写清目标、涉及文件/URL 的绝对路径、期望产物、完成标准；不要让子代理引用对话上文或猜测上下文。
4. 全部返回后汇总：逐路给出结论与产物路径；标出失败、相互冲突或结论矛盾之处；发现疑似更深层的问题转报主会话定夺，不要自行扩大任务范围。
5. 偶发验证：任选一路子代理调用 ListModels，其 `[current]` 应为 `bigmodel-api/GLM-5.3-Flash`；不符则中止汇总并提示检查 `~/.zcode/v2/agents-state.json`。
```

</details>

<details>
<summary><strong><code>commands/heavy.md</code></strong> · <code>/dispatch:heavy</code> 命令</summary>

```markdown
---
description: 把高强度任务拆给多个 GLM-5.3 分身并行深挖，主模型交叉验证后总装。
argument-hint: "<高强度任务描述> [分身数量，默认2-4]"
---

把下面的高强度任务按分析维度拆解，并行派发给 GLM-5.3 分身（heavy-worker）深挖，最后交叉验证并总装：

$ARGUMENTS

调用本命令即视为已点名 heavy 通道与默认分身数（2-4 维度），无需再做四维评分与派发前确认；需要其他通道请用自然语言触发 swarm 技能。

调度规则：

1. 拆 2-4 个真正需要重思考的维度，例如：多个方案各自完整论证、按模块逐个深度审查、攻与守两条线、正反方对辩。纯机械操作不要进这条命令，留给 flash 群集（/dispatch:flash）。
2. 并行派发：在同一条回复里对每个维度各发起一次 Agent 工具调用（并行执行），subagent_type 用 `heavy-worker`（GLM-5.3 分身）；本会话若没有该类型，明确告知用户需要安装并启用 dispatch 插件后重试，不要静默降级到其他类型。
3. 每条派发消息必须自包含：背景、该维度要解决的具体问题、证据要求（引用文件路径与行号、命令输出）、输出格式。
4. 总装：各分身结论一致的部分直接采纳；冲突的部分摆出双方证据，能裁决的裁决，不能裁决的升级给用户；最后输出唯一结论 + 完整证据清单，不抹平真实分歧。
5. 偶发验证：任选一路分身调用 ListModels，其 `[current]` 应为 `bigmodel-api/GLM-5.3`；不符则中止总装并提示检查 dispatch 插件的 agents/heavy-worker.md。
```

</details>

<details>
<summary><strong><code>commands/doctor.md</code></strong> · <code>/dispatch:doctor</code> 六项体检命令</summary>

```markdown
---
description: 自检 dispatch 调度体系健康状态：缓存同步、版本一致、代理定义、模型在列、指向有效、触发词在位。
---

按顺序执行以下六项检查，逐项给出 ✅/❌ 与证据（路径:行号或命令输出），最后给一行总结论：

1. **源码↔缓存一致性**：读取 ZCode 安装清单 `~/.zcode/cli/plugins/installed_plugins.json` 中 dispatch 的 installPath，将其指向的缓存目录与本插件源码目录（`~/.zcode/workspace/<工作区名>/plugins/dispatch`，即安装来源）做 diff（用 `diff -r`），不一致则列出差异文件。
2. **版本一致**：plugin.json、marketplace.json、installed_plugins.json 三处 version 应相同。
3. **代理定义完整性**：检查源码 `agents/*.md` 与 `~/.zcode/agents/*.md`——model 指向自定义/中转 provider（如 new-provider）的必须同时有 `thoughtLevel:` 字段，缺失即会在派发时报「未选择思考档位」。
4. **模型在列**：调用 ListModels，确认路由表引用的模型 ID（`bigmodel-api/GLM-5.3-Flash`、`new-provider/glm-5.3-flashx`、`bigmodel-api/GLM-5.3`）均在列且未 disabled。
5. **指向有效**：installPath 目录存在且含 `.zcode-plugin/plugin.json`。
6. **触发词在位**：`~/.zcode/AGENTS.md` 的并行触发条款含「并发」，任务路由条款含「四维评分」。

发现问题按严重度输出修复建议；凡涉及缓存/installed_plugins.json 的修复，优先建议走正规路径：**源码改好并升版本 → 设置 → 插件管理 → 更新**，不要手改缓存。检查全程只读，不修改任何文件。
```

</details>

<details>
<summary><strong><code>skills/swarm/SKILL.md</code></strong> · 调度技能（核心方法论，7.5 KB）</summary>

```markdown
---
name: swarm
description: 并行调度多模型子代理的打法（Agent 工作流模式：主 Agent 出思路并指挥，子 Agent 执行命令并回传结果）。当用户要求并发/并行/分工/群集/多个AI同时干活（说「并发」即唤醒四维评分与确认流程）、把重任务拆开并行处理、点名子代理模型（flash/flashx/5.3/5.2/5.1 或跨路由中转站模型）、提到工作流/编排/调度子模型或模型分身、或要求先确认并发数量与思考等级时使用。先按散乱度/依赖度/规模/思考难度四维评分推荐通道。四档通道：flashx 快速批处理（默认并发，速度优先）、flash 群集（点名用）、heavy 分身（高强度）、动态工作流（任意模型+编排逻辑）。
---

# 并行调度打法（Agent 工作流模式）

架构：主 Agent＝指挥官——出思路、拆任务、派发、验收、总装，不亲手做子任务；子 Agent＝执行者——执行命令、干活，把结果与产物路径回传主 Agent 汇总。**上下文卫生是并发的首要目的**：子代理吃掉全部过程噪音（读文件、跑命令、试错），主上下文只进精炼结论与证据指针，绝不进原始转储。**切分是思考的产物**：先由主 Agent 想清楚方案，再按方案切互不依赖的块，不机械平分。**回流喂思路**：各路结论是下一轮拆解与方案的输入，形成「思考 → 派发 → 回流 → 再思考」闭环；回流格式固定为「结论 + 证据指针（路径:行号）+ 遗留不确定点」，让下一轮决策直接可用。闭环最多 2 轮回流再思考，第 3 轮必须收敛交付，未决项如实标注。

## 结构评估与派发前确认

收到任务先评四维：**散乱度**（子任务独立占比）、**依赖度**（有无先后/分阶段/循环）、**规模**（子任务数）、**思考难度**（要不要重思考）。评分锚点：依赖度看「下一步的输入是否来自上一步的输出」，规模看估出的子任务数（≥5 记高），散乱度看能否互不依赖地同时开工，难度看要不要重推理；任一维度拿不准时取更保守的一档，连同理由放进确认问让用户拍板。每次派发前必须 AskUserQuestion 确认模型档与并发数（四维评分与推荐通道随问给出，推荐项排第一，默认推荐档 flashx），不得因已设默认档或本会话早前确认过而跳过询问；唯一例外：用户当前消息已明确点名通道/模型/并发数，点名即回答、不重复问（「以后都这样」只能改默认推荐项，不免除逐次询问）。确认后执行：

| 评分组合 | 推荐通道 |
|---|---|
| 有结构（依赖/分阶段/循环） | 动态工作流，`subagent_model` 按确认的模型指定 |
| 散乱独立 + 操作型 | flashx 并发派发（默认通道） |
| 纯难无结构 | heavy 分身；一轮主会话思考能做完的小题直接做 |
| 都低（小任务） | 主会话直接做，不派发 |

思考等级仅动态工作流可选（`subagent_model` 加 `$low/$high/$max`），三档固定代理用其定义等级。用户已在 AGENTS.md 常设授权：结构型任务经此确认后可直接启动 CreateWorkflow，无需每次再说「用工作流」。并发数选项按档位区间生成（区间下限 / 中位 / 上限三档，推荐下限：flash 3、flashx 4、heavy 2）。主会话模型不在确认范围——由用户在模型选择器自选，不要代切。

## 按点名选通道（四档）

| 用户说 | 通道 | 实际模型 |
|---|---|---|
| 默认并发 / 未点名模型 / flashx / 快速完成 / 速度优先 / 大批量 | Agent 工具 `flashx-worker` | `new-provider/glm-5.3-flashx`（基元律动 TokenRhythm 中转，thoughtLevel low） |
| flash / 要更稳结论的操作并发 | Agent 工具 `flash-worker`（缺则回退 `general-purpose`，其已被 agents-state.json 固定为 GLM-5.3-Flash） | `bigmodel-api/GLM-5.3-Flash` |
| 5.3 / 分身 / 高强度 / 深挖 | Agent 工具 `heavy-worker` | `bigmodel-api/GLM-5.3` |
| 工作流 / 用 workflow；点名其他模型（5.2、5.1、任意套餐）；任务有依赖/循环/分阶段 | CreateWorkflow 动态工作流 | ListModels 任意 ID（可跨 provider），`subagent_model` 指定，可加 `$level`；`max_concurrency` 控并发 |

判据：工作流吃的是**结构**不是**难度**——纯难无结构的推理题该给 heavy 分身，工作流帮不上忙。有结构上 Agent 并发会卡在主会话中转；无结构上工作流是白付启动成本。

## 动态工作流档位

三种触发：

1. 用户点名「工作流 / workflow」——必须走 CreateWorkflow，不得用 Agent 并行替代，任务再小也一样；
2. 点名三档之外的模型（`new-provider/glm-5.2`、`glm-5.1` 或其他套餐模型）——只有 `subagent_model` 能指定任意模型与等级；
3. 任务需要编排逻辑：A 群跑完再拆 B、失败自动换档重试、循环修复直到通过、大规模扇出（几百文件/整段 git 历史）。

代价：写 TypeScript 脚本 → 类型检查 → 用户确认 → 后台运行，启动比直接派 Agent 慢一截；简单互不依赖的并行别用它。**成本陷阱：工作流子代理默认跑会话模型（贵），启动前必须按确认结果指定 `subagent_model`**。跑挂了优先 AmendWorkflow 修脚本续跑（自动缓存复用已完成步骤），不要从零重跑。

## 派发纪律

1. 拆出的子任务必须互不依赖；有依赖的留在主会话串行，或转动态工作流在脚本里编排。宁少并行，不造假并行。
2. 并行 = 在同一条回复里对每个子任务各发起一次 Agent 工具调用，不要一个一个等。
3. 每条派发消息自包含：目标、绝对路径、产物要求、完成标准，不依赖对话上文。
4. 汇总时逐路交代结论与产物路径；冲突摆证据；失败如实报。
5. flashx 求速率、结论偏浅：影响决策的关键结论（数字/事实/路径）逐条过目，抽 1-2 条改派 flash 或 5.3 复核，不一致以复核为准并写进汇报。
6. 并发建议：flash 3-6、flashx 4-8、heavy 2-4；未指定模型时走默认通道 flashx、取 4；动态工作流用 `max_concurrency` 限流。
7. 失败处理：派发前确认被用户拒绝或取消 → 按改口方向执行，默认回主会话直接做，不擅自重问；子任务失败可改派同档或高档模型重试一次；连续失败升级用户定夺，不静默重试到成功为止。

## 自检子代理模型

让子代理调用 ListModels：其输出里 `[current]` 标记应等于用户点名的 provider/modelId。不符 = 模型覆盖未生效，提示用户检查 `~/.zcode/v2/agents-state.json`、`~/.zcode/agents/` 下的钉死代理，或 dispatch 插件是否安装启用。思考等级名以 ListModels 实时输出为准（如 5.2 仅 high/max），`$` 后缀填该模型实际列出的档位名，不要硬编码三档。

排障两条：
- 派发报「未选择思考档位 reasoning-level-missing」：中转站等自定义 provider 的代理必须在 agent .md 里写与 `model:` 并列的 `thoughtLevel:` 字段（如 `thoughtLevel: low`）；`$low` 后缀写法在 agent 文件里不生效，只在动态工作流 `subagent_model` 里生效。
- 改了 agent .md 或重装插件后派发行为不变：代理定义与会话启动时加载的 skill 一样是快照，需要新开会话才生效。
```

</details>

## 已知限制

- **会话快照。** 一切定义改动需新会话生效，当次救不了急。
- **doctor 内嵌本机路径。** 检查项 1/5 的源码与缓存路径写死于命令文件，跨机使用需按自身环境调整。
- **触发依赖 AGENTS.md 条款。** doctor 检查项 6 校验的是本机 AGENTS.md；其他用户无此条款时技能仍可按描述触发，但逐次确认纪律的强制性减弱。
- **flashx 通道依赖中转站。** `new-provider` 不在列或被禁用时该通道不可用，doctor 检查项 4 报警。
- **并发无硬上限。** 只有纪律建议值；硬闸仅工作流 `max_concurrency`。

## 常见问题

**每次派发前都要确认，不烦吗？**
并发消耗真实额度，逐次确认是刻意的（D1）。嫌烦就点名：「用 flashx 4 路做 X」——点名即回答，跳过确认。

**flashx 的结论能直接用吗？**
关键结论（数字/事实/路径）不能直接采信，验收时会抽 1-2 条改派高档模型复核，不一致以复核为准（D3）。

**改了插件文件 / AGENTS.md，为什么没生效？**
代理定义与技能都是会话启动快照，新开会话才生效，当次会话救不了急。

**派发报 `reasoning-level-missing`？**
中转站代理的 agent 定义缺 `thoughtLevel:` 字段（D6），与 `model:` 并列补上即可。

**怎么卸载？**
ZCode 设置 → 插件管理 → 卸载，再删除本地市场条目。插件纯声明式、不写任何文件，无残留。

## 贡献

见 [dispatch/MAINTENANCE.md](dispatch/MAINTENANCE.md)。核心要求：

1. 改源码，不改缓存；版本号在 plugin.json 与 marketplace.json 两处同步 +1
2. 更新走 ZCode 设置 → 插件管理 → 更新，不手改 installed_plugins.json（应急路径除外）
3. 命令与技能改动需在真实会话验证派发行为（含 ListModels `[current]` 抽查）

## 兼容性

| 环境 | 状态 |
| --- | --- |
| ZCode（Agent 工具 + CreateWorkflow + AskUserQuestion） | ✅ 已验证 — Windows 11 / GLM-5.3 主会话 / bigmodel-api + new-provider 双 provider |
| 单 provider 安装 | ⚠️ 可安装；flash / heavy 可用，通道分层意义有限 |
| 无中转站 provider | ⚠️ flashx 通道不可用，doctor 检查项 4 报警 |

## 版本历史

| 版本 | 变更 |
| --- | --- |
| 1.0.0 | 合并 subroute：新增 /route 偏好命令（工作区/全局两层状态）与 /collate 分级复核（双轨互证 / P0·P1 全查 / flashx P2 抽查 ≥30% / 账本）；swarm 技能新增「偏好接缝」与「回收复核层」；CHANGELOG.md 建立（五维度）；排障条两条实测修正 |
| 0.3.4 | 默认通道 flash → flashx（未指定模型默认 4 路）；确认政策收紧为逐次必问（点名即回答为唯一例外）；并发数选项改为区间 下限/中位/上限 三档，推荐下限（flash 3、flashx 4、heavy 2） |
| 0.3.3 | 当前安装缓存版本；技能与确认流程基线 |

> 1.0.0 变更依据：合并 subroute 执行记录；变更清单经两路 flashx 子代理独立核实（8/8 属实）。
> 变更依据：0.3.4 源码与 0.3.3 安装缓存的 `diff -r`（差异共三处：`flashx-worker.md`、`skills/swarm/SKILL.md`、版本号）。

## 许可证

[MIT](LICENSE)
