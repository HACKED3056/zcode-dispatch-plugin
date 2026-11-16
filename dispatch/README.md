# dispatch — 并行模型调度插件

Agent 工作流模式：主 Agent＝指挥官（出思路、拆任务、派发、验收、总装），子 Agent＝执行者（执行命令、结果回传）。**用户点名模型即自动调配**：

| 你说 | 通道 | 子代理跑的模型 |
|---|---|---|
| "并发 / flash / 不污染上下文" | `flash-worker` | `bigmodel-api/GLM-5.3-Flash` |
| "flashx / 快速完成 / 速度优先 / 大批量" | `flashx-worker` | `new-provider/glm-5.3-flashx`（中转站） |
| "5.3 / 分身 / 高强度深挖" | `heavy-worker` | `bigmodel-api/GLM-5.3` |
| "工作流 / 用 workflow"、点名其他模型（5.2 / 5.1 / 任意套餐）、任务有依赖/循环/分阶段 | 动态工作流（CreateWorkflow）`subagent_model` | ListModels 任意 ID（跨 provider），可加 `$low/$high/$max` 等级，`max_concurrency` 控并发 |

- **swarm 技能**：并行/分工/工作流/点名模型类请求自动触发调度打法（含结构评估与派发前确认流程）。
- **结构评估（四维评分）**：拆解前先评散乱度/依赖度/规模/思考难度，推荐通道——有结构→动态工作流、散乱独立操作型→flash 并发、纯难无结构→heavy 分身、都低→直接做。
- **派发前确认**：未点名模型/并发数时，先 AskUserQuestion 确认模型（含思考等级，仅工作流档可选）与并发数；已明确则直接派发。结构型任务经确认后可直接启动工作流（AGENTS.md 常设授权）。
- **命令入口**：`/dispatch:flash`、`/dispatch:flashx`、`/dispatch:heavy`（命令调用＝已点名通道，跳过评分与确认）、`/dispatch:doctor`（六项体检）。
- 主会话模型由你在模型选择器里自行选择（如 GLM-5.3），子代理模型由你口头指定。

配合 `~/.zcode/v2/agents-state.json` 中已固定的内置子代理模型（general-purpose / Explore → GLM-5.3-Flash）使用。
