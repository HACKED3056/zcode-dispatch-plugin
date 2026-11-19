---
description: 子代理路由快捷切换：查看/设置当前项目的子代理档位与并发数偏好（写入 .zcode/subroute.json，点名即回答）
argument-hint: "[flashx|flash|heavy|magpie-5.3|magpie-flashx|workflow:<模型ID>|off] [并发数]"
---

# /route —— 子代理路由快捷切换

用户通过本命令**点名**子代理档位。你是主会话模型，按下面规则执行，参数为：`$ARGUMENTS`

## 档位表（数据参考，实际以本会话 Agent 工具可用类型列表为准）

| 档位 | subagent_type | 模型 | 说明 |
|---|---|---|---|
| `flashx` | `flashx-worker` | GLM-5.3-FlashX | 默认并发档，速度优先 |
| `flash` | `flash-worker` | GLM-5.3-Flash | 比 flashx 稳，点名 flash 时用 |
| `heavy` / `5.3` | `heavy-worker` | GLM-5.3 分身 | 高强度深挖：逐文件审查、反例构造、根因分析 |
| `magpie-5.3` | `magpie-heavy-worker` | magpie/auto/glm-5.3 | 任务预置类型，可能已删除，用前确认存在 |
| `magpie-flashx` | `magpie-flashx-worker` | magpie/auto/glm-5.3-flashx | 同上 |
| `workflow:<模型ID>` | （动态工作流） | 任意 ListModels 在列 ID | 需 CreateWorkflow 可用；不可用时如实告知 |
| `off` | — | — | 清除偏好 |

**可用性纪律**：档位对应的 agent 类型不在本会话可用列表时，**如实告知缺失并列出实际可用的近档，让用户重选，绝不静默替换**。

## 状态分两层

| 层 | 文件 | 谁写 | 生效范围 |
|---|---|---|---|
| 工作区覆盖 | 当前工作区 `.zcode/subroute.json` | `/route <档位>`（本命令）、主会话 | 仅本工作区，**优先** |
| 全局默认 | `~/.zcode/subroute/state.json` | 浮层徽标（若启用）、MCP、CLI | 所有工作区的兜底默认 |

读取顺序：工作区覆盖 → 全局默认 → 未设置。两层都只作派发确认问的**默认推荐项**（见 swarm 技能「偏好接缝」节），逐次询问规则不变。

## 执行分支

### A. 参数为空 —— 查看状态
1. Read 工作区 `.zcode/subroute.json` 与全局 `~/.zcode/subroute/state.json`（不存在视为未设置）。
2. 回复小表：生效偏好（含来源层：工作区/全局/未设置）、并发数、更新时间、对应 agent 类型是否仍可用。
3. 附一行提醒：偏好只是**默认推荐项**，每次派发前的确认问不免除。

### B. 参数为 `off` —— 清除偏好
把**工作区** `.zcode/subroute.json` 的 `preferredTier`/`concurrency` 置 null（保留文件）；若用户明说「全局也清」，同步把全局层置 off。回复实际剩余生效层：读全局 `~/.zcode/subroute/state.json`，有偏好则报其 preferredTier（注明来源：全局层），无则报默认推荐档 flashx。

### C. 参数为 `<档位> [并发数]` —— 设置（核心路径）
1. 解析档位；非法值 → 列出合法档位表，不猜。
2. 若给并发数：必须是 1–12 的整数；缺省保持原值或用档位惯例（flash 3-6、flashx 4-8、heavy 2-4；推荐下限：flash 3、flashx 4、heavy 2）。
3. **验证可用性**：该档位 agent 类型在可用列表中（或 workflow: 时 CreateWorkflow 可加载）；不可用 → 按上方纪律处理，终止。
4. Write **工作区**状态文件 `.zcode/subroute.json`（工作区根目录）：

```json
{
  "preferredTier": "flashx",
  "subagentType": "flashx-worker",
  "concurrency": 4,
  "updatedAt": "<ISO 时间>",
  "note": "用户 /route 点名"
}
```

5. 回复确认，**必须包含以下两句语义**：
   - 本次点名即回答：紧接着的下一次派发直接用该档位与并发数，不再重复问；
   - 偏好已存为默认推荐项：之后的**新**派发仍按全局规则逐次询问（只是推荐项指向它）。

### D. 任何分支都不做的事
- 不切换、不建议切换**主会话**模型（本命令只管子代理）；
- 不修改任何 agent 定义文件；
- 不在未经用户确认时把偏好当成免问通行证。
