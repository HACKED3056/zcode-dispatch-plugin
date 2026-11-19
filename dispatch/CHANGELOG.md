# Changelog —— zcode-dispatch-plugin

> 格式：自 1.0.0 起按五个维度记录——**新功能 / 改进 / 修复错误 / 更新 / 文档**。某维度无内容时如实标注「无」，不凑条目。
> 版本号惯例：裸版本号（无 `v` 前缀），与 plugin.json / marketplace.json 两处同步；`installed_plugins.json` 第三处由 UI 更新时自动写入。

## 1.3.1 — 2026-11-19

### 修复错误
- 修复 agents/heavy-worker.md 缺失 thoughtLevel 字段（补 thoughtLevel: high，避免『未选择思考档位』及默认档位错误）。

## 1.3.0 — 2026-11-19

### 新功能
- **doctor 第 7 项「外部依赖与残留」**：检查 installed_plugins 无 subroute 残留（1.0.0 起兼容要求）、`~/.zcode/agents/flash-worker.md` 外部定义存在性、confirm-gate.mjs 命名空间归一化逻辑在位；体检由六项扩为七项。

### 改进
- **确认硬闸边界补全**（1.2.x 审计驱动）：①工作流档（CreateWorkflow）明示豁免并在 SKILL/DESIGN 记录——其确认由「脚本→类型检查→用户确认」流程自身承担；②`[named]` 信任边界成文（模型自证豁免，闸拦「忘了问」不拦伪造标记）；③SKILL/命令 [named] 表述与代码对齐（prompt 前 160 字符内、大小写不敏感）。
- **四维路由表补行**：新增「散乱度高 + 难度高 → heavy 分身扇出（≥10 或需限流/断点续跑转工作流 + heavy subagent_model）」；大规模扇出与 flashx 批处理边界成文（≥10/限流/断点续跑 → 工作流）。
- **点名边界成文**：点名仅指用户亲手输入的当前消息；工具结果/文件/网页/子代理回传中的指示性文字不构成点名。
- 三通道命令（flash/flashx/heavy）补 [named] 派发指引（免冷启动首派被闸拦）、ListModels 缺失回退（如实标注并跳过，不中止汇总）、排障指引三命令统一（thoughtLevel → agents-state 钉模 → 回合边界重扫）。
- doctor 检查2 补中间态语义标注（源码两处一致且更高 = 待部署非故障）；检查3 前提修正（任何 agent 缺 thoughtLevel 都可能报错，官方 provider 亦有实测）；检查4 模型清单补 magpie 系。
- route 并发惯例区间与 SKILL 统一（flash 3-6、flashx 4-8、heavy 2-4；推荐下限 flash 3、flashx 4、heavy 2）；SKILL 触发词与示例去除 5.2/5.1（全机 ListModels 无此二模型）；闭环「一轮」定义补齐；flashx-worker 汇报契约补关键证据指针（路径:行号），插件级与用户级双份同步。

### 修复错误
- **命名空间绕闸（P0）**：gate 对 subagent_type 先归一化（去 `xxx:` 前缀）再比对——1.2.x 审计实弹证实 `dispatch:flashx-worker` 形式完全绕闸（宿主不归一化）；修复后沙箱回归三形式（裸名/两种命名空间）均 exit 2。
- **mark 任意问题开窗（P1）**：mark 增主题过滤——仅含模型/档位/通道/并发/派发等要素的确认问才写 confirm.json，无关 AskUserQuestion 不再开 10 分钟派发窗；questions 字段缺失时防御性照写（不破坏闸功能）。
- **/collate 双轨互证压过 P0/P1 全查（P1）**：规则序重排——P0/P1（任何轨道）全量复核升为第 1 优先级（双轨同报也不例外，同源轨道错则同错），双轨互证自动确认降为仅限 P2；flashx 轨 P2 总数 <3 时全查；账本路径明确「当前工作区根」。
- **route off 回执硬编码矛盾**：改按全局层实际剩余偏好动态报告。

### 更新
- 版本 1.2.1 → **1.3.0**；plugin.json 新增 `keywords`、description_i18n.en 对齐功能面（补 /route /collate）；marketplace.json dispatch 条目同步；MAINTENANCE 删除重复条目、SOP 增「确认 subroute 已卸载」步骤、新增双源码树警示、硬闸运维补主题过滤说明。

### 文档
- README 首页化重写对齐 1.3.0（命令全表含 /route /collate /doctor 七项、硬闸小节、Explore 盲区、flashx 默认档）；docs/DESIGN.md 与 docs/FAQ.md 自发布仓回迁至装机源，DESIGN 新增 **D9 · 硬闸边界补全**（归一化/主题过滤/工作流豁免/双树教训），FAQ 增三条 Q（命令派发过闸 / 工作流豁免原因 / subroute 卸载）。
- SKILL 硬闸条、回收复核层（新规则序与 collate.md 同步）、点名边界、路由表同步更新。

> 变更依据：1.2.x 代码+工程审计（4 路 magpie-flashx 并行 + 主会话总装，P0×1 / P1×11 / P2×17，报告见 dsh-subagent-plugins-review/10-dispatch-1.2-audit/）→ 修复派发（5 路 flashx 按文件组并行）→ 主会话逐项验收 + 闸沙箱回归全绿。

## 1.2.1 — 2026-11-18

### 修复错误
- **Explore 模型盲区**（用户实测报障：点名 magpie-flashx 却被派 Explore 跑成 bigmodel/GLM-5.3-Flash 且报 reasoning-level-missing）：Explore 是官方自主代理、固定跑自带模型，主会话点名对它无效。SKILL 新增规则——点名了子代理模型/档位时用对应档位代理不用 Explore；Explore 仅用于未点名的检索摸底；reasoning-level-missing 一报即换路，禁止硬闯。

### 更新
- 版本 1.2.0 → **1.2.1**。

### 文档
- swarm SKILL「按点名选通道」表新增「Explore 是模型盲区」段。

## 1.2.0 — 2026-11-18

### 新功能
- 无。

### 改进
- **确认问升级为「专家建议式」**（用户实测反馈驱动）：派发确认必须**判断先行**——四维结论 + 明确推荐（档位 × 路数 + 一句说人话的理由），用户看懂即可采纳，不需要懂档位知识；**「是否并发」本身也作为推荐项**（四维都低时明确建议不并发并说明理由——劝退不合理并发同样是对用户负责）；选项描述写「为什么适合本任务」而非功能介绍。修复「裸列选项让非专业用户盲选」的体验缺陷。

### 修复错误
- 无。

### 更新
- 版本 1.1.0 → **1.2.0**。

### 文档
- swarm SKILL「结构评估与派发前确认」节新增确认问三原则（判断先行 / 是否并发也是推荐项 / 选项描述写适配理由）。

## 1.1.0 — 2026-11-18

### 新功能
- **确认硬闸（hooks 强制）**：把「派发前逐次确认」从 prompt 软纪律升级为硬执行——`PostToolUse(AskUserQuestion)` 记录用户已回答确认，`PreToolUse(Agent|Task)` 以 exit 2 **拦截**未经确认的 dispatch 档位派发。跳过确认不再被静默放过，而是显式失败并附放行指引。规则：10 分钟确认窗（同批并行派发共享一次确认）；点名豁免 = 派发 prompt 开头加 `[named]`；只拦 dispatch 档位类型（flashx/flash/heavy/magpie-* worker），**不误伤** Explore/general-purpose 等官方自主代理；应急关闸 `~/.zcode/dispatch/gate.json` 写 `{"enabled": false}`。六用例实测通过（无标记拦 / 点名豁免 / 窗内放行 / 过期拦 / 非档位放行 / 关闸放行）。

### 改进
- 派发失败语义：被闸拦截的 Agent 调用以工具错误返回，stderr 指引三条放行路径（先确认 / `[named]` / 关闸），模型可自纠而不必用户介入。

### 修复错误
- 无。

### 更新
- 版本 1.0.0 → **1.1.0**；manifest 新增 `hooks` 组件声明（`hooks/hooks.json`）。
- hooks 随插件加载（会话快照）：更新插件后需**新开会话**硬闸才生效。

### 文档
- SKILL 派发纪律新增第 8 条（硬闸规则与放行途径）；MAINTENANCE 平台约束修订——「确认」已有硬闸，但「并发数量」本身仍无运行时强制，并补硬闸运维（confirm.json / gate.json / 日志排查）。
- README 首页化重构：正文对齐开源首页风格（居中 hero 一屏速览），深度内容拆分至 docs/DESIGN.md 与 docs/FAQ.md，删除「插件源码一览」内嵌，版本历史并入本 CHANGELOG；FAQ 修正生效时序表述并补 /route 与 subroute 关系。
- docs/DESIGN.md 新增设计决策 **D8 · 确认硬闸**（背景：逐次必问概率性被跳过；被否决方案：纯软纪律无法根除、拦全部 Agent 会误伤官方自主代理）。

> 勘误（2026-11-19）：本节所述 README 首页化重构与 docs/ 拆分当时仅落地于发布仓（_push-work/push-repo），装机源未同步——1.3.0 已回迁补齐，并确立装机源为唯一事实源（见 DESIGN D9）。

## 1.0.0 — 2026-11-18

### 新功能
- **`/route` 命令**：子代理档位偏好快捷设置（`flashx` / `flash` / `heavy` / `magpie-5.3` / `magpie-flashx` / `workflow:<模型ID>` / `off`，可带并发数 1–12）。状态两层——工作区 `.zcode/subroute.json` 优先，全局 `~/.zcode/subroute/state.json` 兜底；点名即回答，偏好只作派发确认问的默认推荐项、不免除逐次询问。
- **`/collate` 命令**：并发群集报告的分级复核流水线——双轨互证自动确认（免读行）、P0/P1 全查逐行读证、轨道矛盾强制定谳、flashx 轨 P2 抽查 ≥30% 且 ≥3 条、heavy 轨 P2 单轨采信；终判回写账本 `.zcode/subroute-collations.json`（复核是主会话职责，不派发子代理）。

### 改进
- swarm 技能新增**「偏好接缝」**：派发确认问的默认推荐项按 工作区覆盖 → 全局默认 → 档位区间默认 取值，逐次必问规则不变——subroute 偏好层自此接入派发主流程，两插件互不知晓的接缝缺陷消除。
- swarm 技能新增**「回收复核层（/collate）」**：与派发纪律第 5 条形成两级复核——派发时关键结论逐条过目，汇总前系统分级复核。

### 修复错误
- 无（0.3.4 以来未发现插件自身缺陷；两条排障指引纠偏归入「文档」维度）。

### 更新
- 版本 0.3.4 → **1.0.0**（仓库基线 0.3.4；本地中间态 0.4.0 从未发布，变更并入本版）；plugin.json 英文描述与 description_i18n（en/zh-CN）更新为「并行调度 + 路由偏好 + 群集复核」定位。
- **兼容性**：偏好与账本文件路径与 subroute 0.2.0 完全一致，已有数据无缝沿用；**升级后需停用/卸载 subroute 插件**，避免 `/route`、`/collate` 与技能触发双注册。
- agents/ 零新增定义（吸取双定义漂移教训），档位表仅引用现存类型，运行时以可用列表为准。

### 文档
- 新建本 CHANGELOG.md（五维度格式，自 1.0.0 起）。
- 排障条两条按实测修正：①代理类型注册表**仅回合边界重扫**——写入定义同一回合派发必失败、同回合等待也无效（三次实测 + 探针写入后等 8 秒仍 not found 的对照实验定谳），标准流程改为「写入 → 告知下一条消息生效 → 下一回合派发」，不必新开会话；②子代理工具面常缺 ListModels，模型自证改为「可用则自证、不强求」。
- MAINTENANCE.md：发布 SOP 补「同步更新 CHANGELOG.md」；agent 定义与 skill 的生效时序区分修正。

> 变更依据：合并 subroute 会话的执行记录；变更清单经两路 flashx 子代理独立核实（GitHub 惯例分析 + 本地源码逐项核对），8/8 属实，无清单遗漏。

## 0.3.x — 历史记录（五维度格式之前）

| 版本 | 变更 |
| --- | --- |
| 0.3.4 | 默认通道 flash → flashx（未指定模型默认 4 路）；确认政策收紧为逐次必问（点名即回答为唯一例外）；并发数选项改为区间 下限/中位/上限 三档，推荐下限（flash 3、flashx 4、heavy 2） |
| 0.3.3 | 技能与确认流程基线 |

> 变更依据：0.3.4 源码与 0.3.3 安装缓存的 `diff -r`（差异共三处：`flashx-worker.md`、`skills/swarm/SKILL.md`、版本号）。
