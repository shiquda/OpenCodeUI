import { memo } from 'react'
import type { StepFinishPart } from '../../../types/message'

interface StepFinishPartViewProps {
  part: StepFinishPart
}

/**
 * 格式化数字，如 1234 -> 1.2k
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

/**
 * 格式化 cost
 */
function formatCost(cost: number): string {
  if (cost < 0.01) return '<$0.01'
  return '$' + cost.toFixed(3)
}

export const StepFinishPartView = memo(function StepFinishPartView({ part }: StepFinishPartViewProps) {
  const { tokens, cost } = part
  const totalTokens = tokens.input + tokens.output + tokens.reasoning
  const cacheHit = tokens.cache.read
  
  return (
    <div className="flex items-center gap-3 text-[10px] text-text-500 px-1 py-0.5">
      {/* Tokens */}
      <div className="flex items-center gap-1.5">
        <TokenIcon />
        <span title={`Input: ${tokens.input}, Output: ${tokens.output}, Reasoning: ${tokens.reasoning}`}>
          {formatNumber(totalTokens)} tokens
        </span>
        {cacheHit > 0 && (
          <span className="text-text-600" title={`Cache read: ${tokens.cache.read}, write: ${tokens.cache.write}`}>
            ({formatNumber(cacheHit)} cached)
          </span>
        )}
      </div>
      
      {/* Cost */}
      {cost > 0 && (
        <div className="flex items-center gap-1">
          <CostIcon />
          <span>{formatCost(cost)}</span>
        </div>
      )}
    </div>
  )
})

function TokenIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
      <path d="M12 2v20M2 12h20" />
    </svg>
  )
}

function CostIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 9h6M9 15h6" />
    </svg>
  )
}
