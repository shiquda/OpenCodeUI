// ============================================
// Message Types - 直接对齐 API 数据结构
// ============================================

// ============================================
// Message Info (元信息)
// ============================================

export interface MessageTime {
  created: number
  completed?: number
}

export interface TokenUsage {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

export interface ModelRef {
  providerID: string
  modelID: string
}

export interface PathInfo {
  cwd: string
  root: string
}

export interface MessageSummary {
  title?: string
  body?: string
  diffs?: unknown[]
}

// User message info
export interface UserMessageInfo {
  id: string
  sessionID: string
  role: 'user'
  time: MessageTime
  agent: string
  model: ModelRef
  variant?: string
  summary?: MessageSummary
}

// Assistant message info
export interface AssistantMessageInfo {
  id: string
  sessionID: string
  role: 'assistant'
  time: MessageTime
  parentID: string  // 指向用户消息
  modelID: string
  providerID: string
  mode: string
  agent: string
  path: PathInfo
  cost: number
  tokens: TokenUsage
  finish?: 'stop' | 'tool-calls' | string
  error?: { name: string; data: unknown }
}

export type MessageInfo = UserMessageInfo | AssistantMessageInfo

// ============================================
// Part Types (内容部分)
// ============================================

interface PartBase {
  id: string
  sessionID: string
  messageID: string
}

export interface TextPart extends PartBase {
  type: 'text'
  text: string
  synthetic?: boolean  // 系统生成的上下文
  time?: { start: number; end?: number }
}

export interface ReasoningPart extends PartBase {
  type: 'reasoning'
  text: string
  time: { start: number; end?: number }
}

export interface ToolState {
  status: 'pending' | 'running' | 'completed' | 'error'
  input?: unknown
  output?: unknown
  title?: string
  error?: { name: string; data: unknown } | string
  time?: { start: number; end?: number }
  metadata?: {
    diff?: string
    filediff?: {
      file: string
      before: string
      after: string
      additions: number
      deletions: number
    }
    filepath?: string
    output?: string
    exit?: number
    truncated?: boolean
    [key: string]: unknown
  }
}

export interface ToolPart extends PartBase {
  type: 'tool'
  callID: string
  tool: string
  state: ToolState
}

export interface FilePart extends PartBase {
  type: 'file'
  mime: string
  filename?: string
  url: string
  source?: {
    text?: { value: string; start: number; end: number }
    type?: string
    path?: string
  }
}

export interface AgentPart extends PartBase {
  type: 'agent'
  name: string
  source?: { value: string; start: number; end: number }
}

export interface StepStartPart extends PartBase {
  type: 'step-start'
  snapshot?: string
}

export interface StepFinishPart extends PartBase {
  type: 'step-finish'
  reason: string
  cost: number
  tokens: TokenUsage
  snapshot?: string
}

export interface SubtaskPart extends PartBase {
  type: 'subtask'
  prompt: string
  description: string
  agent: string
  model?: ModelRef
  command?: string
}

export interface SnapshotPart extends PartBase {
  type: 'snapshot'
  snapshot: string
}

export interface PatchPart extends PartBase {
  type: 'patch'
  hash: string
  files: string[]
}

export interface RetryPart extends PartBase {
  type: 'retry'
  attempt: number
  error: { name: string; data: unknown }
  time: { created: number }
}

export interface CompactionPart extends PartBase {
  type: 'compaction'
  auto?: boolean
}

export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | FilePart
  | AgentPart
  | StepStartPart
  | StepFinishPart
  | SubtaskPart
  | SnapshotPart
  | PatchPart
  | RetryPart
  | CompactionPart

// ============================================
// Message (完整消息)
// ============================================

export interface Message {
  info: MessageInfo
  parts: Part[]
  // UI 状态
  isStreaming?: boolean
}

// ============================================
// 辅助类型
// ============================================

/** 检查消息是否为用户消息 */
export function isUserMessage(info: MessageInfo): info is UserMessageInfo {
  return info.role === 'user'
}

/** 检查消息是否为助手消息 */
export function isAssistantMessage(info: MessageInfo): info is AssistantMessageInfo {
  return info.role === 'assistant'
}

/** 检查消息是否有可见内容 */
export function hasVisibleContent(message: Message): boolean {
  return message.parts.some(part => {
    switch (part.type) {
      case 'text':
        return part.text.trim().length > 0
      case 'reasoning':
        return part.text.trim().length > 0
      case 'tool':
        return true
      case 'file':
      case 'agent':
        return true
      case 'step-finish':
        return true  // 显示 token 信息
      case 'subtask':
        return true
      default:
        return false
    }
  })
}

/** 获取消息的纯文本内容 */
export function getMessageText(message: Message): string {
  return message.parts
    .filter((p): p is TextPart => p.type === 'text' && !p.synthetic)
    .map(p => p.text)
    .join('')
}
