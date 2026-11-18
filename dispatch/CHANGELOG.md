# Changelog —— zcode-dispatch-plugin

> 格式：自 1.0.0 起按五个维度记录——**新功能 / 改进 / 修复错误 / 更新 / 文档**。某维度无内容时如实标注「无」，不凑条目。
> 版本号惯例：裸版本号（无 `v` 前缀），与 plugin.json / marketplace.json 两处同步；`installed_plugins.json` 第三处由 UI 更新时自动写入。

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
