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
