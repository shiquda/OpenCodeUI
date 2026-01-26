// ============================================
// API Types - 所有 API 相关的类型定义
// ============================================

export const API_BASE = 'http://127.0.0.1:4096'

// ============================================
// Model Types
// ============================================

export interface ApiModel {
  id: string
  providerID: string
  name: string
  family: string
  status: 'active' | 'disabled' | 'unavailable'
  limit: {
    context: number
    output: number
  }
  capabilities: {
    temperature: boolean
    reasoning: boolean
    attachment: boolean
    toolcall: boolean
    input: {
      text: boolean
      audio: boolean
      image: boolean
      video: boolean
      pdf: boolean
    }
    output: {
      text: boolean
      audio: boolean
      image: boolean
      video: boolean
      pdf: boolean
    }
  }
  variants?: Record<string, Record<string, unknown>>
}

export interface ApiProvider {
  id: string
  name: string
  source: string
  models: Record<string, ApiModel>
}

export interface ProvidersResponse {
  providers: ApiProvider[]
  default: Record<string, string>
}

export interface ModelInfo {
  id: string
  name: string
  providerId: string
  providerName: string
  family: string
  contextLimit: number
  outputLimit: number
  supportsReasoning: boolean
  supportsImages: boolean
  supportsToolcall: boolean
  variants: string[]
}

// ============================================
// Agent Types
// ============================================

export interface ApiAgentPermission {
  permission: string
  action: 'allow' | 'ask' | 'deny'
  pattern: string
}

export interface ApiAgent {
  name: string
  description?: string
  mode: 'subagent' | 'primary' | 'all'
  native?: boolean
  hidden?: boolean
  temperature?: number
  topP?: number
  color?: string
  prompt?: string
  permission?: ApiAgentPermission[]
  options?: Record<string, unknown>
  model?: {
    modelID: string
    providerID: string
  }
}

// ============================================
// Project Types
// ============================================

export interface ApiProject {
  id: string
  worktree: string
  vcs?: 'git'
  name?: string
  icon?: {
    url?: string
    override?: string
    color?: string
  }
  time: {
    created: number
    updated: number
    initialized?: number
  }
  sandboxes: string[]
}

// ============================================
// Path Types
// ============================================

export interface ApiPath {
  home: string
  state: string
  config: string
  worktree: string
  directory: string
}

// ============================================
// Session Types
// ============================================

export interface ApiSession {
  id: string
  slug?: string
  projectID: string
  directory: string
  parentID?: string
  title: string
  time: {
    created: number
    updated: number
    archived?: number
  }
  summary?: {
    additions: number
    deletions: number
    files: number
  }
  share?: {
    url: string
  }
  revert?: {
    messageID: string
    partID?: string
    snapshot?: string
    diff?: string
  }
}

export interface SessionListParams {
  directory?: string
  roots?: boolean
  start?: number
  search?: string
  limit?: number
}

export interface SessionRevertState {
  messageID: string
  partID?: string
  snapshot?: string
  diff?: string
}

// ============================================
// Message Types
// ============================================

export interface ApiUserMessage {
  id: string
  sessionID: string
  role: 'user'
  time: { created: number }
  agent: string
  model: { providerID: string; modelID: string }
  variant?: string
  summary?: { title?: string; body?: string }
}

export interface ApiAssistantMessage {
  id: string
  sessionID: string
  role: 'assistant'
  time: { created: number; completed?: number }
  parentID: string
  modelID: string
  providerID: string
  mode: string
  agent: string
  path: { cwd: string; root: string }
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  error?: { name: string; data: unknown }
  finish?: string
}

export type ApiMessage = ApiUserMessage | ApiAssistantMessage

// ============================================
// Part Types
// ============================================

export interface ApiTextPart {
  id: string
  sessionID: string
  messageID: string
  type: 'text'
  text: string
  synthetic?: boolean
  time?: { start: number; end?: number }
}

export interface ApiReasoningPart {
  id: string
  sessionID: string
  messageID: string
  type: 'reasoning'
  text: string
  time: { start: number; end?: number }
}

export interface ApiToolPart {
  id: string
  sessionID: string
  messageID: string
  type: 'tool'
  callID: string
  tool: string
  state: {
    status: 'pending' | 'running' | 'completed' | 'error'
    input?: unknown
    output?: unknown
    title?: string
    time?: { start: number; end?: number }
    error?: { name: string; data: unknown }
    metadata?: Record<string, unknown>
  }
}

export interface ApiFilePart {
  id: string
  sessionID: string
  messageID: string
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

export interface ApiAgentPart {
  id: string
  sessionID: string
  messageID: string
  type: 'agent'
  name: string
  source?: { value: string; start: number; end: number }
}

export interface ApiStepStartPart {
  id: string
  sessionID: string
  messageID: string
  type: 'step-start'
  snapshot?: string
}

export interface ApiStepFinishPart {
  id: string
  sessionID: string
  messageID: string
  type: 'step-finish'
  reason: string
  snapshot?: string
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
}

export interface ApiSnapshotPart {
  id: string
  sessionID: string
  messageID: string
  type: 'snapshot'
  snapshot: string
}

export interface ApiPatchPart {
  id: string
  sessionID: string
  messageID: string
  type: 'patch'
  hash: string
  files: string[]
}

export interface ApiRetryPart {
  id: string
  sessionID: string
  messageID: string
  type: 'retry'
  attempt: number
  error: { name: string; data: unknown }
  time: { created: number }
}

export interface ApiCompactionPart {
  id: string
  sessionID: string
  messageID: string
  type: 'compaction'
  auto?: boolean
}

export interface ApiSubtaskPart {
  id: string
  sessionID: string
  messageID: string
  type: 'subtask'
  prompt: string
  description: string
  agent: string
  model?: { providerID: string; modelID: string }
  command?: string
}

export type ApiPart = 
  | ApiTextPart 
  | ApiReasoningPart 
  | ApiToolPart 
  | ApiFilePart 
  | ApiAgentPart
  | ApiStepStartPart 
  | ApiStepFinishPart
  | ApiSnapshotPart
  | ApiPatchPart
  | ApiRetryPart
  | ApiCompactionPart
  | ApiSubtaskPart
  | { type: string; [key: string]: unknown }

export interface ApiMessageWithParts {
  info: ApiMessage
  parts: ApiPart[]
}

// ============================================
// Permission Types
// ============================================

export interface ApiPermissionRequest {
  id: string
  sessionID: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: {
    messageID: string
    callID: string
  }
}

export type PermissionReply = 'once' | 'always' | 'reject'

// ============================================
// Question Types
// ============================================

export interface ApiQuestionOption {
  label: string
  description: string
}

export interface ApiQuestionInfo {
  question: string
  header: string
  options: ApiQuestionOption[]
  multiple?: boolean
  custom?: boolean
}

export interface ApiQuestionRequest {
  id: string
  sessionID: string
  questions: ApiQuestionInfo[]
  tool?: {
    messageID: string
    callID: string
  }
}

export type QuestionAnswer = string[]

// ============================================
// File Types
// ============================================

export interface FileNode {
  name: string
  type: 'file' | 'directory'
  size?: number
  modified?: number
}

export interface FileDiff {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
}

export interface SymbolInfo {
  name: string
  kind: number
  location: {
    uri: string
    range: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }
  containerName?: string
}

// ============================================
// Event Types
// ============================================

export interface GlobalEvent {
  directory: string
  payload: {
    type: string
    properties: unknown
  }
}

export interface EventCallbacks {
  onMessageUpdated?: (message: ApiMessage) => void
  onPartUpdated?: (part: ApiPart) => void
  onPartRemoved?: (data: { id: string; messageID: string; sessionID: string }) => void
  onSessionUpdated?: (session: ApiSession) => void
  onSessionCreated?: (session: ApiSession) => void
  onSessionError?: (error: { sessionID: string; name: string; data: unknown }) => void
  onSessionIdle?: (data: { sessionID: string }) => void
  onPermissionAsked?: (request: ApiPermissionRequest) => void
  onPermissionReplied?: (data: { sessionID: string; requestID: string; reply: PermissionReply }) => void
  onQuestionAsked?: (request: ApiQuestionRequest) => void
  onQuestionReplied?: (data: { sessionID: string; requestID: string; answers: QuestionAnswer[] }) => void
  onQuestionRejected?: (data: { sessionID: string; requestID: string }) => void
  onError?: (error: Error) => void
}

// ============================================
// Send Message Types
// ============================================

import type { Attachment } from '../components/Attachment'

export type { Attachment } from '../components/Attachment'

/**
 * @deprecated 使用 Attachment 代替
 */
export interface FileAttachment {
  mime: string
  url: string
  filename?: string
}

export interface RevertedMessage {
  text: string
  attachments: Attachment[]
}

export interface SendMessageParams {
  sessionId: string
  text: string
  attachments: Attachment[]
  model: {
    providerID: string
    modelID: string
  }
  agent?: string
  variant?: string
  /** 工作目录（项目目录） */
  directory?: string
}

export interface SendMessageResponse {
  info: ApiAssistantMessage
  parts: ApiPart[]
}
