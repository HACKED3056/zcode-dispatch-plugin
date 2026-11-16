# dispatch 并行调度插件 · 分析报告

| 项 | 值 |
|---|---|
| 报告日期 | 2026-11-16 |
| 插件名称 | dispatch（并行调度 / Dispatch） |
| 源码版本 | **0.3.4**（`plugin.json` 与 `marketplace.json` 一致） |
| 已安装缓存版本 | **0.3.3**（存在一次未走 UI 更新的版本漂移，见 §5.1） |
| 作者 / 许可 | HACKED / MIT |
| 源码位置 | `C:\Users\HACKED\.zcode\workspace\default\plugins\dispatch` |
| 打包位置 | 桌面 `zcode-dispatch-plugin\`（本仓库根目录） |

---

## 1. 项目定位

dispatch 是一个 **ZCode 并行模型调度插件**，实现「Agent 工作流模式」：主 Agent＝指挥官（出思路、拆任务、派发、验收、总装），子 Agent＝执行者（执行命令、回传结论与产物路径）。核心价值有两个：

1. **上下文卫生**——子代理吃掉全部过程噪音（读文件、跑命令、试错），主上下文只进精炼结论与证据指针（`路径:行号`）；
2. **模型成本分层**——操作型任务下沉给廉价快速模型（flashx/flash），重思考任务才动用与主模型同级的 heavy 分身，有编排需求的走动态工作流。

插件形态为**纯 Markdown + JSON**（代理定义、slash 命令、技能各一个目录），无构建产物、无运行时依赖，随会话启动快照加载。

## 2. 文件清单（14 个文件，26,517 字节）

| 文件 | 字节 | 用途 |
|---|---:|---|
| `README.md` | 3,690 | 仓库说明（安装/使用/结构）★新增 |
| `REPORT.md` | — | 本分析报告 ★新增 |
| `LICENSE` | 1,063 | MIT ★新增 |
| `.gitignore` | 90 | 忽略 OS/编辑器临时文件 ★新增 |
| `marketplace.json` | 810 | 本地市场清单（displayName「并行调度」） |
| `dispatch/.zcode-plugin/plugin.json` | 1,264 | 插件清单（版本、双语描述、目录映射） |
| `dispatch/README.md` | 1,930 | 插件说明（通道路由表 + 触发规则） |
| `dispatch/MAINTENANCE.md` | 1,899 | 维护手册（改动 SOP / 应急路径 / 平台约束） |
| `dispatch/agents/flashx-worker.md` | 789 | 快速执行子代理定义 |
| `dispatch/agents/heavy-worker.md` | 1,137 | 高强度分身定义 |
| `dispatch/commands/flash.md` | 1,488 | `/dispatch:flash` 命令 |
| `dispatch/commands/flashx.md` | 1,610 | `/dispatch:flashx` 命令 |
| `dispatch/commands/heavy.md` | 1,649 | `/dispatch:heavy` 命令 |
| `dispatch/commands/doctor.md` | 1,611 | `/dispatch:doctor` 六项体检命令 |
| `dispatch/skills/swarm/SKILL.md` | 7,487 | 核心调度技能（评分/路由/纪律/排障） |

## 3. 组件详解

### 3.1 插件清单 `.zcode-plugin/plugin.json`

声明 `name: dispatch`、`version: 0.3.4`、中英双语描述、`agents/commands/skills` 三个目录映射，作者 HACKED，MIT 许可。清单内无 hooks、无 MCP 服务器——本插件是纯「定义型」插件，只向 ZCode 注入代理、命令与技能。

### 3.2 子代理定义 `agents/`（2 个）

| 代理 | 模型 | 关键字段 | 定位 |
|---|---|---|---|
| `flashx-worker`（青色） | `new-provider/glm-5.3-flashx` | `thoughtLevel: low`（必填，中转站代理缺失会报「未选择思考档位」） | 快速执行：速度优先、不纠结长推理，汇报「结论 + 产物路径 + 风险点」，超出能力如实上报 |
| `heavy-worker`（红色） | `bigmodel-api/GLM-5.3` | 无 thoughtLevel（bigmodel 原生 provider 不需要） | 高强度分身：只深挖分派维度，结论必须带证据（路径:行号/命令输出），产出自包含 |

注意：`flash-worker` **不在本插件内**——`/dispatch:flash` 命令优先用 `flash-worker`，缺失时回退 `general-purpose`（其模型已被用户 `agents-state.json` 固定为 GLM-5.3-Flash），这是有意的外部依赖设计。

### 3.3 Slash 命令 `commands/`（4 个）

| 命令 | 默认并发 | 行为要点 |
|---|---|---|
| `/dispatch:flash <任务> [n]` | 3 路（建议 3-6） | 拆互不依赖子任务并行派发；失败/冲突如实报；ListModels 偶发验证 `[current]` |
| `/dispatch:flashx <任务> [n]` | 4 路（建议 4-8） | 同上；**关键结论逐条过目 + 抽 1-2 条改派 flash/5.3 复核**（对冲 flashx 结论偏浅） |
| `/dispatch:heavy <任务> [n]` | 2-4 维度 | 按维度深挖 → 主模型交叉验证总装；冲突摆证据裁决，不抹平真实分歧 |
| `/dispatch:doctor` | — | 六项体检（见 §5.3） |

四条命令共同纪律：**命令调用＝已点名通道，跳过四维评分与派发前确认**；派发消息必须自包含（目标、绝对路径、产物要求、完成标准）。

### 3.4 调度技能 `skills/swarm/SKILL.md`（核心，7.5KB）

技能本体是整套方法论，包含五个部分：

1. **架构原则**：上下文卫生是首要目的；切分是思考的产物（先想清楚方案再切块，不机械平分）；回流喂思路（「思考→派发→回流→再思考」闭环，最多 2 轮回流，第 3 轮必须收敛）。
2. **四维评分**：散乱度（独立子任务占比）/ 依赖度（下一步输入是否来自上一步输出）/ 规模（≥5 子任务记高）/ 思考难度；拿不准取保守档。映射：有结构→动态工作流、散乱独立操作型→flashx（默认通道）、纯难无结构→heavy、都低→主会话直接做。
3. **派发前确认**：每次派发必须 AskUserQuestion 确认模型档与并发数（推荐项排第一、默认推荐 flashx）；唯一例外是用户当前消息已点名。并发数选项按档位区间生成，推荐下限（flash 3 / flashx 4 / heavy 2）。
4. **派发纪律**（7 条）：互不依赖才并行、同一条回复发全部 Agent 调用、派发消息自包含、汇总逐路交代、flashx 结论复核、并发区间建议、失败处理（用户拒绝→按改口方向执行不重问；子任务失败可同档或高档重试一次，连续失败升级用户）。
5. **自检与排障**：ListModels 看 `[current]` 是否等于点名模型；两条已知坑——中转站代理必须写 `thoughtLevel:`（`$low` 后缀只在 `subagent_model` 生效）、代理定义是会话快照需新会话生效。

### 3.5 文档 `README.md` / `MAINTENANCE.md`

插件内 README 面向使用者（通道路由表、触发词、入口命令）；MAINTENANCE 面向维护者：正规路径（改源码→双处升版本→UI 更新→清旧缓存→新会话生效）、应急路径（手拷缓存+手改 installed_plugins.json，仅 UI 不可用时）、以及四条无法修复只能规避的平台约束（会话快照、并发无硬上限、中转站 thoughtLevel、工作流默认跑会话模型的成本陷阱）。

## 4. 运行机制（一次完整调度闭环）

```
用户消息（触发词/点名/命令）
   │
   ├─ 命令入口 ────────────→ 已点名通道，跳过评分确认 ─┐
   ├─ 自然语言触发 ──→ swarm 技能唤醒                   │
   │                      ├─ 四维评分 → 推荐通道        │
   │                      └─ AskUserQuestion 确认 ─────┤
   ▼                                                    ▼
 主会话拆解（切分是思考的产物，不机械平分）
   │  同一条回复内发出全部 Agent 调用（真并行）
   ▼
 子代理执行（过程噪音留在子上下文）
   │  回流格式固定：结论 + 证据指针(路径:行号) + 遗留不确定点
   ▼
 主模型验收总装（冲突裁决 / flashx 关键结论抽查复核）
   │  未收敛 → 再拆一轮（最多 2 轮回流）
   ▼
 交付（第 3 轮必须收敛，未决项如实标注）
```

## 5. 现状发现

### 5.1 ⚠️ 版本漂移：源码 0.3.4 vs 已装缓存 0.3.3

字节级证据（源 vs 缓存）：`agents/flashx-worker.md` **789 vs 734**、`skills/swarm/SKILL.md` **7,487 vs 7,165**，其余文件一致。即源码升到 0.3.4 后**尚未走「设置→插件管理→更新」**，当前会话生效的仍是 0.3.3 快照。建议按 MAINTENANCE SOP：UI 更新 → 删除缓存下 `0.3.3` 旧目录 → 新开会话。

### 5.2 机器绝对路径（跨机复用需注意）

`doctor.md` 与 `MAINTENANCE.md` 内嵌本机绝对路径（`C:\Users\HACKED\...`、`dev-default-aa05e249` 等）。他人克隆使用时，doctor 检查项 1/5 与维护 SOP 需按自身环境调整；插件功能本体（agents/commands/skills 路由逻辑）不受影响。

### 5.3 外部依赖清单（插件能跑的前提）

- `~/.zcode/AGENTS.md` 并行触发条款（doctor 检查项 6 校验「并发」「四维评分」字样在位）
- `~/.zcode/v2/agents-state.json` 将 general-purpose/Explore 固定为 GLM-5.3-Flash（flash 通道回退依据）
- 中转站 provider（`new-provider/glm-5.3-flashx`）在 ListModels 在列且未禁用（doctor 检查项 4）
- `installed_plugins.json` installPath 指向有效（doctor 检查项 5）

### 5.4 质量评价

纯定义型插件，无构建/测试/CI 需求，风险面小。设计上可圈可点：点名即免问的例外设计、flashx 浅结论的强制复核机制、失败处理的「不静默重试到成功」原则、回流轮数上限防发散，都是实用的工程纪律。代码组织清晰，每个文件单一职责。

## 6. GitHub 上传指引

本仓库已做 git 初始化（main 分支、首个 commit）。上传到 GitHub 只差：

```bash
cd C:/Users/HACKED/Desktop/zcode-dispatch-plugin

# 方式 A：已装 gh CLI
gh repo create zcode-dispatch-plugin --public --source=. --push

# 方式 B：手动建仓后推送
git remote add origin https://github.com/<你的用户名>/zcode-dispatch-plugin.git
git push -u origin main
```

建议仓库设置：描述填 `ZCode 并行模型调度插件：四维评分路由 + 四档通道（flashx/flash/heavy/动态工作流）`；Topics 建议 `zcode` `plugin` `agent-workflow` `parallel-dispatch` `llm-agents`。

## 7. 改进建议

1. **消除版本漂移**：走 UI 更新到 0.3.4，并用 `/dispatch:doctor` 复核六项全绿。
2. **路径参数化**：doctor 与 MAINTENANCE 中的绝对路径改为「以 installed_plugins.json 实际读到的为准 + 相对路径推导」，提升跨机可用性（doctor 部分已这么做了，可推广到文档）。
3. **仓库可含 CHANGELOG**：目前版本历史只存在于版本号与缓存目录名中，建仓后补一份 CHANGELOG.md 便于他人跟进。
4. **可选英文文档**：plugin.json 已有双语描述，README 目前纯中文；若面向公开受众可加英文版或双语段落。
