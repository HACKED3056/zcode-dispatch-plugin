---
description: 把操作型任务并行铺开到 flash 子代理群集（GLM-5.3-Flash）执行并汇总。
argument-hint: "<任务描述> [并行数量，默认3]"
---

把下面的任务拆成多个互不依赖的子任务，并行派发给 flash 子代理群集执行，最后汇总：

$ARGUMENTS

调用本命令即视为已点名 flash 通道与默认并发（3 路），无需再做四维评分与派发前确认；并行派发的每条 prompt 前 160 字符内标注 `[named]`（本命令调用即视为点名豁免，免被确认硬闸拦截）。需要其他通道请用自然语言触发 swarm 技能。

调度规则：

1. 未指定数量时拆 3 路；子任务之间必须互不依赖，有依赖关系的步骤留在主会话串行做，不要强行并行。
2. 并行派发：在同一条回复里对每个子任务各发起一次 Agent 工具调用（并行执行），subagent_type 优先用 `flash-worker`（GLM-5.3-Flash）；本会话若没有该类型则用 `general-purpose`（已被 agents-state.json 固定为 GLM-5.3-Flash）。
3. 每条派发消息必须自包含：写清目标、涉及文件/URL 的绝对路径、期望产物、完成标准；不要让子代理引用对话上文或猜测上下文。
4. 全部返回后汇总：逐路给出结论与产物路径；标出失败、相互冲突或结论矛盾之处；发现疑似更深层的问题转报主会话定夺，不要自行扩大任务范围。
5. 偶发验证：任选一路子代理调用 ListModels，其 `[current]` 应为 `bigmodel-api/GLM-5.3-Flash`。子代理工具面缺 ListModels 时，如实标注『ListModels 不可用，以宿主环境标识为准』并跳过该步，不中止汇总；不符或报 reasoning-level-missing 时：依次检查对应代理定义文件的 `thoughtLevel` 字段（中转/自定义 provider 必写）、`~/.zcode/v2/agents-state.json` 钉模、以及代理注册表仅回合边界重扫（新写入的定义下一条消息才生效）。
