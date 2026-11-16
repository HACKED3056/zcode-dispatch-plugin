# Dispatch · ZCode 并行调度插件

> **Parallel model dispatch for ZCode in agent-workflow mode** — the main agent commands, subagents execute and report back.
> ZCode 并行模型调度插件：主 Agent＝指挥官（出思路、拆任务、派发、验收、总装），子 Agent＝执行者（执行命令、结果回传）。

## ✨ 功能特性

- **四维评分路由**：拆解前先评 散乱度 / 依赖度 / 规模 / 思考难度，自动推荐执行通道
- **四档通道**：flashx 快速批（默认并发档）、flash 群集、heavy 分身、动态工作流（任意跨路由模型 + 思考等级控制）
- **派发前确认**：未点名模型/并发数时，先经 AskUserQuestion 确认模型档与并发数，不静默派发
- **上下文卫生**：子代理吃掉全部过程噪音，主上下文只进精炼结论与证据指针
- **Slash 命令**：`/dispatch:flash`、`/dispatch:flashx`、`/dispatch:heavy`（点名即派发）、`/dispatch:doctor`（六项体检）

## 🧭 通道路由表

| 触发方式 | 通道 | 子代理模型 |
|---|---|---|
| 默认并发 / "flashx" / "快速完成" / "速度优先" / 大批量 | `flashx-worker` | `new-provider/glm-5.3-flashx`（thoughtLevel low） |
| "flash" / 要更稳结论的操作并发 | `flash-worker` | `bigmodel-api/GLM-5.3-Flash` |
| "5.3" / "分身" / "高强度深挖" | `heavy-worker` | `bigmodel-api/GLM-5.3` |
| "工作流" / 点名其他模型（5.2、5.1 等）/ 任务有依赖、循环、分阶段 | CreateWorkflow 动态工作流 | ListModels 任意 ID（`subagent_model` 指定，可加 `$low/$high/$max`） |

## 📁 目录结构

```
zcode-dispatch-plugin/
├── README.md               ← 本文件
├── REPORT.md               ← 插件分析报告
├── LICENSE                 ← MIT
├── marketplace.json        ← 本地插件市场清单（含本仓库即可作为市场目录）
└── dispatch/               ← 插件本体（v0.3.4）
    ├── .zcode-plugin/plugin.json   ← 插件清单
    ├── agents/            ← 子代理定义（flashx-worker / heavy-worker）
    ├── commands/          ← slash 命令（flash / flashx / heavy / doctor）
    ├── skills/swarm/      ← 并行调度技能（四维评分 + 派发纪律）
    ├── README.md          ← 插件说明
    └── MAINTENANCE.md     ← 维护手册（改动 SOP / 应急路径 / 平台约束）
```

## 📦 安装

**方式一：本地市场（推荐）**

1. 克隆本仓库到任意目录
2. ZCode → 设置 → 插件市场 → 添加市场 → 本地目录 → 选择本仓库根目录（含 `marketplace.json`）
3. 在插件管理中安装 **Dispatch（并行调度）**

**方式二：手动放置**

将 `dispatch/` 目录复制到你的工作区 `plugins/` 目录下，并在其 `marketplace.json` 中登记条目。

## 🚀 使用

- **自然语言触发**：消息中出现「并发 / 并行 / 分工 / 群集」或点名模型，自动唤醒 swarm 技能的评分与确认流程
- **点名即派发**：「用 flashx 并发 4 路做…」「派 heavy 分身深挖…」
- **Slash 直达**：`/dispatch:flashx 批量重命名这批文件 4`（命令调用＝已点名通道，跳过评分与确认）
- **健康自检**：`/dispatch:doctor`

## 🔧 维护

改动请遵循 [dispatch/MAINTENANCE.md](dispatch/MAINTENANCE.md) 的 SOP：改源码 → 双处升版本 → 设置→插件管理→更新 → 清理旧缓存 → **新开会话生效**。

## 📄 分析报告

见 [REPORT.md](REPORT.md)——含文件清单、逐组件分析、运行机制、现状发现与上传指引。

## License

[MIT](LICENSE) © HACKED
