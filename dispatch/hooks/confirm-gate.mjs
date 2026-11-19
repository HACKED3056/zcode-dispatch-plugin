#!/usr/bin/env node
// dispatch confirm-gate —— 把「派发前逐次确认」从软纪律升级为硬闸。
// 官方 hook 协议（zcode-guide/diagnosing-hooks）：
//   PostToolUse ^AskUserQuestion$ → mark：确认问已被用户回答，写确认标记
//   PreToolUse  ^(Agent|Task)$    → gate：dispatch 档位派发无新鲜标记且无豁免 → exit 2 拦截
// 退出码语义：0 放行；2 拦截（stderr 写原因）；其他非零 = 脚本错误（不拦，仅记录）。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DATA_DIR = path.join(os.homedir(), '.zcode', 'dispatch')
const CONFIRM_FILE = path.join(DATA_DIR, 'confirm.json')
const GATE_FILE = path.join(DATA_DIR, 'gate.json')
// 一次确认管 10 分钟窗口：同批并行派发共享一次确认，符合「逐次必问」的批次语义
const WINDOW_MS = 10 * 60 * 1000
// 只拦 dispatch 档位类型；Explore / general-purpose 等官方或野生代理不误伤。
// 命名空间前缀（如 dispatch:flashx-worker）先归一化再比对（1.3.0 修复：宿主不归一化，实弹曾绕闸）
const GATED_TYPES = new Set([
  'flashx-worker', 'flash-worker', 'heavy-worker',
  'magpie-flash-worker', 'magpie-flashx-worker', 'magpie-heavy-worker',
])

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => { data += c })
    process.stdin.on('end', () => resolve(data))
    // 兜底：stdin 未正常关闭时 2 秒后继续（hook 场景必有 end，防御而已）
    setTimeout(() => resolve(data), 2000).unref?.()
  })
}

const mode = process.argv[2] || 'gate'
const raw = await readStdin()
let input = {}
try { input = JSON.parse(raw) } catch {}

if (mode === 'mark') {
  // 1.3.0 起主题过滤：仅派发确认类问题（模型/档位/并发等要素）落标记；questions 缺失时防御性照写
  const ti = input.tool_input ?? input.toolInput
  const questions = ti && typeof ti === 'object' ? ti.questions : undefined
  const parseable = Array.isArray(questions) && questions.length > 0
  if (parseable) {
    let text = ''
    for (const q of questions) {
      if (!q || typeof q !== 'object') continue
      text += ' ' + String(q.question ?? '')
      if (Array.isArray(q.options)) {
        for (const o of q.options) {
          if (o && typeof o === 'object') text += ' ' + String(o.label ?? '') + ' ' + String(o.description ?? '')
        }
      }
    }
    if (!/模型|档位|通道|并发|派发|路数|工作流|workflow|flashx|flash|heavy|magpie/i.test(text)) {
      process.exit(0) // 无关问题：不开派发窗
    }
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(CONFIRM_FILE, JSON.stringify({ confirmedAt: Date.now() }) + '\n', 'utf8')
  } catch {}
  process.exit(0)
}

// ---- gate 模式 ----
const gate = readJson(GATE_FILE)
if (gate && gate.enabled === false) process.exit(0) // 应急关闸（用户显式操作）

const toolInput = input.tool_input ?? input.toolInput ?? {}
const subagentType = String(toolInput.subagent_type ?? toolInput.subagentType ?? '')
const prompt = String(toolInput.prompt ?? '')

const bareType = subagentType.replace(/^.*:/, '')
if (!GATED_TYPES.has(bareType)) process.exit(0) // 非 dispatch 档位：不管
if (/\[\s*(named|点名)\s*\]/i.test(prompt.slice(0, 160))) process.exit(0) // 点名豁免标记

const confirm = readJson(CONFIRM_FILE)
if (confirm && typeof confirm.confirmedAt === 'number' && Date.now() - confirm.confirmedAt < WINDOW_MS) {
  process.exit(0) // 确认窗口内
}

process.stderr.write(
  'dispatch 硬闸：未经确认的子代理派发已被拦截（' + subagentType + '）。\n' +
  '放行方式三选一：\n' +
  '  1) 先用 AskUserQuestion 确认模型档与并发数——用户回答后 10 分钟窗口内可直接派发；\n' +
  '  2) 用户已在当前消息点名模型与并发数（点名即回答）→ 在派发 prompt 开头加 [named] 后重试；\n' +
  '  3) 应急关闸：~/.zcode/dispatch/gate.json 写 {"enabled": false}。\n',
)
process.exit(2)
