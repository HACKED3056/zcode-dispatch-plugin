---
description: 自检 dispatch 调度体系健康状态：缓存同步、版本一致、代理定义、模型在列、指向有效、触发词在位。
---

按顺序执行以下六项检查，逐项给出 ✅/❌ 与证据（路径:行号或命令输出），最后给一行总结论：

1. **源码↔缓存一致性**：读取 `C:\Users\HACKED\.zcode\cli\plugins\installed_plugins.json` 中 dispatch 的 installPath，将其指向的缓存目录与源码 `C:\Users\HACKED\.zcode\workspace\default\plugins\dispatch` 做 diff（用 `diff -r`），不一致则列出差异文件。
2. **版本一致**：plugin.json、marketplace.json、installed_plugins.json 三处 version 应相同。
3. **代理定义完整性**：检查源码 `agents/*.md` 与 `~/.zcode/agents/*.md`——model 指向自定义/中转 provider（如 new-provider）的必须同时有 `thoughtLevel:` 字段，缺失即会在派发时报「未选择思考档位」。
4. **模型在列**：调用 ListModels，确认路由表引用的模型 ID（`bigmodel-api/GLM-5.3-Flash`、`new-provider/glm-5.3-flashx`、`bigmodel-api/GLM-5.3`）均在列且未 disabled。
5. **指向有效**：installPath 目录存在且含 `.zcode-plugin/plugin.json`。
6. **触发词在位**：`~/.zcode/AGENTS.md` 的并行触发条款含「并发」，任务路由条款含「四维评分」。

发现问题按严重度输出修复建议；凡涉及缓存/installed_plugins.json 的修复，优先建议走正规路径：**源码改好并升版本 → 设置 → 插件管理 → 更新**，不要手改缓存。检查全程只读，不修改任何文件。
