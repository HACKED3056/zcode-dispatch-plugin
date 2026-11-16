# dispatch 插件分析报告

> 本报告是**分析文档**；使用与设计见 [README.md](README.md)。两者分工：README 回答「是什么、怎么用、为何这样设计」，本报告回答「实现得怎么样、与生态的差距、怎么发布」。

| 文档信息 | | |
|---|---|---|
| 报告日期 | 2026-11-16 | |
| 分析对象 | dispatch v0.3.4（源码）/ 0.3.3（安装缓存） | |
| 方法 | 全量通读 10 个插件源文件 · 与 0.3.3 缓存 `diff -r` · 与官方 anet 插件逐文件对比 | |

---

## 1. 结论摘要

- **完成度**：FR1-FR8 八项功能需求全部落地，实现位置可逐一追溯（§3）。
- **健壮性缺口（仅一处）**：源码 0.3.4 与安装缓存 0.3.3 存在版本漂移，一次 UI 更新可消除（§4.1）。
- **与官方插件的工程差距**：双语文档、安全专章、`userConfig` 参数化三点可借鉴 anet（§6）。

## 2. 文件清单与规模

插件本体 10 个文件、约 21 KB；打包仓库 15 个文件、26.5 KB（新增 README / REPORT / LICENSE / .gitignore / marketplace.json）。

| 文件 | 字节 | 角色 |
|---|---:|---|
| `.zcode-plugin/plugin.json` | 1,264 | 清单：版本、双语描述、agents/commands/skills 目录映射 |
| `agents/flashx-worker.md` | 789 | Executor：极速档（`new-provider/glm-5.3-flashx`，thoughtLevel low） |
| `agents/heavy-worker.md` | 1,137 | Executor：重思考档（`bigmodel-api/GLM-5.3`） |
| `commands/flash.md` | 1,488 | `/dispatch:flash`，默认 3 路 |
| `commands/flashx.md` | 1,610 | `/dispatch:flashx`，默认 4 路，附结论复核条款 |
| `commands/heavy.md` | 1,649 | `/dispatch:heavy`，按维度拆 2-4 路 |
| `commands/doctor.md` | 1,611 | `/dispatch:doctor` 六项体检，全程只读 |
| `skills/swarm/SKILL.md` | 7,487 | **核心**：评分、路由、确认、纪律、排障全部方法论 |
| `README.md` / `MAINTENANCE.md` | 1,930 / 1,899 | 使用说明 / 改动 SOP + 应急路径 + 平台约束 |
| `marketplace.json`（仓库根） | 810 | 本地市场清单，克隆即可作为市场目录 |

## 3. 需求追溯矩阵

| 需求 | 状态 | 实现位置 |
|---|---|---|
| FR1 四维评分路由 | ✅ | `SKILL.md`「结构评估与派发前确认」 |
| FR2 四档通道 | ✅ | `SKILL.md`「按点名选通道」+ `agents/*.md` |
| FR3 点名/命令直达（免确认） | ✅ | 三条命令的「调用即视为已点名」条款 + SKILL 例外条款 |
| FR4 派发前确认 | ✅ | SKILL 确认流程 + `~/.zcode/AGENTS.md` 触发条款 |
| FR5 上下文卫生 / 回流格式 | ✅ | SKILL 架构段 + 各命令「派发消息自包含」规则 |
| FR6 汇总验收与复核 | ✅ | `flashx.md` 规则 4 / `heavy.md` 规则 4 / SKILL 纪律 5 |
| FR7 失败处理纪律 | ✅ | SKILL 派发纪律 7 + 回流 2 轮上限 |
| FR8 健康自检 | ✅ | `doctor.md` 六项体检 |

## 4. 现状发现

### 4.1 版本漂移：源码 0.3.4 vs 安装缓存 0.3.3

字节级证据（源 vs 缓存）：`flashx-worker.md` **789 vs 734**、`SKILL.md` **7,487 vs 7,165**，其余一致。源码升级后未走「设置 → 插件管理 → 更新」，当前会话生效的仍是 0.3.3 快照。

**修复**：UI 更新 → 删除缓存下 `dispatch/0.3.3/` 旧版本目录 → 新开会话 → `/dispatch:doctor` 六项全绿。

### 4.2 机器绝对路径

`doctor.md` 检查项 1/5 与 `MAINTENANCE.md` SOP 曾内嵌形如 `C:\Users\<用户名>\...` 的本机绝对路径与机器市场 ID（发布副本已通用化为 `~` 与占位符写法，本机源码仍为私有原版）。

### 4.3 外部依赖

- `~/.zcode/AGENTS.md` 触发条款（doctor 检查项 6 校验「并发」「四维评分」字样在位）
- `~/.zcode/v2/agents-state.json`：general-purpose 固定为 GLM-5.3-Flash（flash 通道回退依据）
- 中转站 provider（`new-provider/glm-5.3-flashx`）在 ListModels 在列且未禁用

### 4.4 平台约束（不可修复，只能规避）

会话快照（改动需新会话生效）· Agent 工具并发无硬上限 · 中转站代理必须写 `thoughtLevel:`（`$low` 后缀仅 `subagent_model` 生效）· 工作流子代理默认跑会话模型（须显式指定 `subagent_model`）。

## 5. 质量评估

- **设计**：点名即免问例外、flashx 浅结论强制复核、失败「重试一次即升级」、回流 2 轮上限防发散——四条纪律分别对准上下文污染、成本错配、调度负担、质量失控四个痛点，需求-实现-验证链条闭合。
- **组织**：每文件单一职责；7.5 KB 的 SKILL 承载全部方法论而无代码，可读性好。
- **风险面**：纯声明式、零构建，无供应链/运行时风险；风险集中在版本漂移与外部依赖（§4）。

## 6. 生态对比：dispatch vs anet（官方市场 v0.1.3）

**定性**：不是竞品。dispatch 解决**会话内、本机内**的并行调度（用哪档自己的模型、开几路、结论怎么验收）；anet 解决**跨机器、跨主体**的任务委托（经 A2A 协议把任务发给网络上他人的智能体，E2E 加密、可付费）。二者可叠加：anet 的外部智能体可作为 dispatch 的「第五通道」。

| 维度 | dispatch | anet |
|---|---|---|
| 执行者 | 本机子代理（自有 4 档模型） | 他人节点上的智能体（AID 发现） |
| 架构 | 纯声明式，零代码零脚本 | MCP 服务器（14 工具）+ 3 个 POSIX 脚本 + 外部 CLI 守护进程 |
| 模型路由 | **核心能力** | 无（anet 不跑模型） |
| 经济系统 | 无金钱，token 成本分层 | a2a-x402 付费技能，三档限额默认 0 |
| 安全模型 | 上下文卫生 + 复核纪律 | E2E 加密、签名清单、安全默认、不可信输入纪律 |
| 外部依赖 | 无 | anet CLI ≥0.3.0、hub、curl/gzip/ssh-keygen |
| 平台 | 处处能跑 | 启动器 POSIX-only，Windows 官方不支持自动接线 |
| 文档 | 中文 | 英文 + 中文双 README + 安全专章 + 排障表 |

**可借鉴 anet 的五点**（按性价比排序）：

1. **双语 README**——面向公开受众的标配；
2. **「安全与副作用」专章**——本插件零脚本、零写盘、零网络，把「零副作用」明写成章即是信任卖点；
3. **`userConfig` 设置项**——用官方机制参数化 doctor/MAINTENANCE 的路径，替代硬编码（同时解决 §4.2）；
4. **故障排查表**——doctor 六项 + 两条排障经验从 SKILL/MAINTENANCE 提出为「症状 → 处理」表；
5. **幂等派发语义**——anet 的 `message_id` 防重复任务/重复付费；dispatch 的「失败重试一次」可吸收同一思想：重试须声明是重试而非新任务（工作流 AmendWorkflow 复用缓存已是此思想）。

## 7. 发布指引

```bash
cd <本仓库路径>
# 方式 A：gh CLI
gh repo create zcode-dispatch-plugin --public --source=. --push
# 方式 B：手动建仓
git remote add origin https://github.com/<用户名>/zcode-dispatch-plugin.git
git push -u origin main
```

- 仓库描述：`ZCode 并行模型调度插件：四维评分路由 + 四档通道（flashx/flash/heavy/动态工作流），主 Agent 指挥、子 Agent 执行`
- Topics：`zcode` `plugin` `agent-workflow` `parallel-dispatch` `llm-agents`
- 建议随发布补 `CHANGELOG.md`（当前版本历史仅存于 README 与缓存目录名）
