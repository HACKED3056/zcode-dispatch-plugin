# dispatch 维护手册

## 改动 SOP（正规路径，替代手改缓存）

1. 改源码（本插件源码目录，通常为 `~/.zcode/workspace/<工作区名>/plugins/dispatch/`）；
2. 升版本：`plugin.json` 与 `plugins/marketplace.json` 两处同步 +1（例 0.3.2 → 0.3.3；`installed_plugins.json` 的第三处由 UI 更新时自动写入，无需手改）；
3. ZCode **设置 → 插件管理 → dispatch → 更新**：UI 会重新拷贝源码到缓存并正确写入 installed_plugins.json；
4. 清理：删除缓存 `~/.zcode/cli/plugins/cache/<市场ID>/dispatch/` 下的旧版本目录（保留 installPath 指向的当前版本）；
5. **新开会话**生效（skill / 代理定义 / AGENTS.md 均为会话启动快照，当次会话不热更新）。

## 应急路径（仅当 UI 更新不可用）

手动拷贝源码到 `~/.zcode/cli/plugins/cache/<市场ID>/dispatch/<新版本>/`，备份后手改 installed_plugins.json 的 `version` 与 `installPath` 两个字段。下次改动务必回归正规路径，避免版本漂移。

## 自检

- `/dispatch:doctor` —— 六项体检：缓存一致性 / 版本一致 / thoughtLevel 完整 / 模型在列 / 指向有效 / 触发词在位。
- 派发验证：让子代理调 ListModels，看 `[current]` 是否等于点名的 provider/modelId。

## 已知平台约束（无法修复，只能规避）

- **会话快照**：一切定义改动需新会话生效，当次救不了急。
- **Agent 工具并发无硬上限**：只有纪律建议值（flash 3-6 / flashx 4-8 / heavy 2-4）；硬闸只有工作流的 `max_concurrency`。
- **中转站代理**（new-provider 等）的 agent .md 必须写 `thoughtLevel:`；`$low` 后缀只在动态工作流 `subagent_model` 有效，agent 文件里无效。
- **工作流子代理默认跑会话模型（贵）**：启动前必须按确认结果指定 `subagent_model`。
