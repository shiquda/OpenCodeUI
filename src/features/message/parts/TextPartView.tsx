import { memo } from 'react'
import { MarkdownRenderer } from '../../../components'
import type { TextPart } from '../../../types/message'

interface TextPartViewProps {
  part: TextPart
  isStreaming?: boolean
}

export const TextPartView = memo(function TextPartView({ part, isStreaming }: TextPartViewProps) {
  // 跳过空文本（除非正在 streaming）
  if (!part.text?.trim() && !isStreaming) return null
  
  // 跳过 synthetic 文本（系统上下文，单独处理）
  if (part.synthetic) return null
  
  return (
    <div className="font-claude-response">
      <MarkdownRenderer content={part.text} />
    </div>
  )
})
