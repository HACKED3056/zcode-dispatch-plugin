<h1 align="center">Zcode-dispatch</h1>

<p align="center">
  <strong>ZCode 并行模型调度插件：把「该不该并发、用哪个模型、开几路、结论可不可信」固化成可复用的调度纪律。</strong>
</p>

<p align="center">
  主 Agent 只指挥，子 Agent 只干活——主上下文只进结论，不进过程噪音。
</p>

<p align="center"><sub>独立的社区插件，与 ZCode 官方不存在隶属、合作、授权或背书关系。深度设计说明见 <a href="docs/DESIGN.md">docs/DESIGN.md</a>，常见问题见 <a href="docs/FAQ.md">docs/FAQ.md</a>。</sub></p>

---

## 触发与路由

| 你说 | 通道 | 子代理模型 |
|---|---|---|
| 「并发 / 并行 / 分工 / 群集 / 多个AI同时干活」等未点名触发 | 四维评分 + **flashx 默认推荐** | `new-provider/glm-5.3-flashx` |
| 「flash / 要更稳结论」 | `flash-worker` | `bigmodel-api/GLM-5.3-Flash` |
| 「5.3 / 分身 / 高强度深挖」 | `heavy-worker` | `bigmodel-api/GLM-5.3` |
| 「工作流」或点名其他模型（5.2 / 5.1 等） | CreateWorkflow | ListModels 任意 ID |

**结构评估（四维评分）**：散乱度 / 依赖度 / 规模 / 思考难度——有结构→动态工作流；**散乱独立操作型→flashx 并发（默认通道）**；纯难无结构→heavy 分身；都低→主会话直接做。派发确认是「专家建议式」：判断先行，四维结论 + 推荐档 × 路数 + 一句理由（1.2.0 起）。

**Explore 盲区**：点名子代理模型时用对应档位代理，不用 Explore（官方自主代理，点名对它无效）。

内置子代理（general-purpose/Explore）模型可被 `~/.zcode/v2/agents-state.json` 钉模覆盖——以运行时验证为准。

## 命令

| 命令 | 作用 |
| --- | --- |
| `/dispatch:flash` `/dispatch:flashx` `/dispatch:heavy` | 点名通道直接派发；命令调用＝已点名，prompt 前 160 字符标 `[named]` |
| `/dispatch:route <档位> [并发数]` | 子代理档位偏好，工作区覆盖 → 全局兜底两层状态 |
| `/dispatch:collate [抽查比例%]` | 分级复核流水线，账本 `.zcode/subroute-collations.json` |
| `/dispatch:doctor` | 七项体检（缓存一致 / 版本一致 / 代理定义 / 模型在列 / 指向有效 / 触发词在位 / subroute 残留） |

## 确认硬闸

未经确认的档位派发会被 PreToolUse 钩子拦截（exit 2）。三条放行途径：AskUserQuestion 确认（10 分钟窗）；点名（prompt 前 160 字符标 `[named]`）；应急关闸 `~/.zcode/dispatch/gate.json` 写 `{"enabled": false}`。命名空间形式（`dispatch:flashx-worker`）已归一化拦截；动态工作流档明示豁免（自带脚本→类型检查→用户确认链）；Explore / general-purpose 不经闸。

深度设计决策（D1–D9）见 [docs/DESIGN.md](docs/DESIGN.md)；已知限制与常见问题见 [docs/FAQ.md](docs/FAQ.md)。

## License

[MIT](LICENSE)
