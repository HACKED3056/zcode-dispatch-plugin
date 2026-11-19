# dispatch 维护手册

## 改动 SOP（正规路径，替代手改缓存）

1. 改源码（本目录 `C:\Users\HACKED\.zcode\workspace\default\plugins\dispatch\`）；
2. 升版本：`plugin.json` 与 `plugins/marketplace.json` 两处同步 +1（例 0.3.2 → 0.3.3；`installed_plugins.json` 的第三处由 UI 更新时自动写入，无需手改）；**同步更新 `CHANGELOG.md`**（五维度：新功能/改进/修复错误/更新/文档，空缺维度如实标「无」）；
3. ZCode **设置 → 插件管理 → dispatch → 更新**：UI 会重新拷贝源码到缓存并正确写入 installed_plugins.json；
4. 清理：删除缓存 `~/.zcode/cli/plugins/cache/dev-default-aa05e249/dispatch/` 下的旧版本目录（保留 installPath 指向的当前版本）；
5. 确认 `subroute@subroute-local` 已卸载（dispatch 1.0.0 起的兼容要求，避免 /route、/collate 双注册；/dispatch:doctor 第 7 项可查）；
6. **新开会话**生效（skill / 代理定义 / AGENTS.md 均为会话启动快照，当次会话不热更新）。

## 应急路径（仅当 UI 更新不可用）

手动拷贝源码到 `~/.zcode/cli/plugins/cache/dev-default-aa05e249/dispatch/<新版本>/`，备份后手改 installed_plugins.json 的 `version` 与 `installPath` 两个字段。下次改动务必回归正规路径，避免版本漂移。

## 自检

- `/dispatch:doctor` —— 六项体检：缓存一致性 / 版本一致 / thoughtLevel 完整 / 模型在列 / 指向有效 / 触发词在位。
- 派发验证：让子代理调 ListModels，看 `[current]` 是否等于点名的 provider/modelId。

## 已知平台约束（无法修复，只能规避）

- **会话快照**：skill 与命令改动需新会话生效（agent 定义例外：回合边界重扫，下一条消息生效，不必新会话）。
- **Agent 工具并发无硬上限**：只有纪律建议值（flash 3-6 / flashx 4-8 / heavy 2-4）；硬闸只有工作流的 `max_concurrency`。注意：1.1.0 起「派发前确认」已有 hook 硬闸（见 hooks/confirm-gate.mjs），但「并发数量」本身仍无运行时强制——模型确认后开多少路依旧靠纪律。
- **硬闸运维**：确认标记 `~/.zcode/dispatch/confirm.json`（10 分钟窗）；应急关闸 `~/.zcode/dispatch/gate.json` 写 `{"enabled": false}`（删除该文件即恢复）；hook 执行记录看 ZCode 日志（outcome 含 blocked）。confirm.json 仅在确认问含模型/档位/并发等要素时写入（1.3.0 起 mark 主题过滤；questions 字段缺失时防御性照写）。
- **中转站代理**（new-provider 等）的 agent .md 必须写 `thoughtLevel:`；`$low` 后缀只在动态工作流 `subagent_model` 有效，agent 文件里无效。
- **工作流子代理默认跑会话模型（贵）**：启动前必须按确认结果指定 `subagent_model`。
- **双源码树警示**：`_push-work/push-repo/` 是发布仓——以本目录为唯一事实源，发布后由发布流程从本目录重新生成，禁止双边各自编辑（1.1.0 README/docs 分叉教训，见 docs/DESIGN.md D9）。
