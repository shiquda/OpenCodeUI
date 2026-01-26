// Re-export all types
export * from './chat'

// 新的 Message 类型（对齐 API）
// 注意：这会和 chat.ts 中的 Message 冲突，使用时需要明确指定
export type {
  Message as ApiMessage,
  MessageInfo,
  UserMessageInfo,
  AssistantMessageInfo,
  Part,
  TextPart,
  ReasoningPart,
  ToolPart,
  FilePart,
  AgentPart,
  StepStartPart,
  StepFinishPart,
  SubtaskPart,
  TokenUsage,
} from './message'

export {
  isUserMessage,
  isAssistantMessage,
  hasVisibleContent,
  getMessageText,
} from './message'
