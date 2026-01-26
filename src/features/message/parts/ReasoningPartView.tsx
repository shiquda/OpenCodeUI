import { memo, useState, useRef, useEffect } from 'react'
import { ChevronDownIcon } from '../../../components/Icons'
import { ScrollArea } from '../../../components/ui'
import type { ReasoningPart } from '../../../types/message'

function ThinkingIcon({ isActive }: { isActive?: boolean }) {
  return (
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={isActive ? 'animate-pulse' : ''}
    >
      <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.5 6.5 6 7.5V19a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1.5c3.5-1 6-4 6-7.5a8 8 0 0 0-8-8Z" />
      <path d="M10 22h4" />
    </svg>
  )
}

interface ReasoningPartViewProps {
  part: ReasoningPart
  isStreaming?: boolean
}

export const ReasoningPartView = memo(function ReasoningPartView({ part, isStreaming }: ReasoningPartViewProps) {
  // 跳过空的 reasoning
  if (!part.text?.trim() && !isStreaming) return null
  
  const isPartStreaming = isStreaming && !part.time?.end
  const [expanded, setExpanded] = useState(isPartStreaming)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (isPartStreaming) {
      setExpanded(true)
    } else {
      setExpanded(false)
    }
  }, [isPartStreaming])

  // 滚动 ScrollArea 内部到底部
  useEffect(() => {
    if (isPartStreaming && expanded && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [part.text, isPartStreaming, expanded])

  return (
    <div className={`border border-border-300/20 rounded-xl overflow-hidden transition-[width] duration-300 ease-out ${
      expanded ? 'w-full' : 'w-[260px]'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-text-500 text-sm hover:bg-bg-200/30 transition-colors"
      >
        <ThinkingIcon isActive={isPartStreaming} />
        <span className="text-xs font-medium whitespace-nowrap">
          {isPartStreaming ? 'Thinking...' : 'Thinking'}
        </span>
        <span className={`ml-auto transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDownIcon />
        </span>
      </button>
      
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${
        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}>
        <div className="overflow-hidden">
          <ScrollArea ref={scrollAreaRef} maxHeight={192} className="border-t border-border-300/20 bg-bg-200/30">
            <div className="px-3 py-2 text-text-300 text-xs font-mono whitespace-pre-wrap">
              {part.text}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
})
