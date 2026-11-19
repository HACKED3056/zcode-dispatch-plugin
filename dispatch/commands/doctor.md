---
description: 自检 dispatch 调度体系健康状态：缓存同步、版本一致、代理定义、模型在列、指向有效、触发词在位、外部依赖。
---

按顺序执行以下七项检查，逐项给出 ✅/❌ 与证据（路径:行号或命令输出），最后给一行总结论：

1. **源码↔缓存一致性**：读取 ZCode 安装清单 `~/.zcode/cli/plugins/installed_plugins.json` 中 dispatch 的 installPath，将其指向的缓存目录与本插件源码目录（`~/.zcode/workspace/<工作区名>/plugins/dispatch`，即安装来源）做 diff（用 `diff -r`），不一致则列出差异文件。
2. **版本一致**：plugin.json、marketplace.json、installed_plugins.json 三处 version 应相同。三处不一致时区分：源码两处（plugin.json/marketplace.json）一致且更高 = 待部署中间态（提醒走 UI 更新，非故障）；其他不一致 = 异常。
3. **代理定义完整性**：检查源码 `agents/*.md` 与 `~/.zcode/agents/*.md`——**任何** agent 定义缺 `thoughtLevel:` 字段都可能报『未选择思考档位』（2026-11-18 官方 provider 的 Explore 实测同样报错）；中转/自定义 provider（如 new-provider、magpie）属必写，官方 provider 建议也显式写明。
4. **模型在列**：调用 ListModels，确认路由表引用的模型 ID（`bigmodel-api/GLM-5.3-Flash`、`new-provider/glm-5.3-flashx`、`bigmodel-api/GLM-5.3`、`magpie/auto/glm-5.3`、`magpie/auto/glm-5.3-flashx`）均在列且未 disabled。
5. **指向有效**：installPath 目录存在且含 `.zcode-plugin/plugin.json`。
6. **触发词在位**：`~/.zcode/AGENTS.md` 的并行触发条款含「并发」，任务路由条款含「四维评分」。
7. **外部依赖与残留**：`~/.zcode/cli/plugins/installed_plugins.json` 无 `subroute` 残留条目（dispatch 1.0.0 起要求卸载）；`~/.zcode/agents/flash-worker.md` 存在（flash 通道外部依赖，插件不随附）；`hooks/confirm-gate.mjs` 含命名空间归一化逻辑（grep `replace(/^.*:/`）。

发现问题按严重度输出修复建议；凡涉及缓存/installed_plugins.json 的修复，优先建议走正规路径：**源码改好并升版本 → 设置 → 插件管理 → 更新**，不要手改缓存。检查全程只读，不修改任何文件。
