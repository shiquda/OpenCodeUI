/**
 * DiffModal - 全屏 Diff 查看器
 */

import { memo, useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { diffLines, diffWords } from 'diff'
import { CloseIcon } from './Icons'
import { detectLanguage } from '../utils/languageUtils'

// ============================================
// Types
// ============================================

interface DiffModalProps {
  isOpen: boolean
  onClose: () => void
  diff: { before: string; after: string } | string
  filePath?: string
  language?: string
  diffStats?: { additions: number; deletions: number }
}

type LineType = 'add' | 'delete' | 'context' | 'empty'

interface DiffLine {
  type: LineType
  content: string
  lineNo?: number
  highlightedContent?: string
}

interface PairedLine {
  left: DiffLine
  right: DiffLine
}

interface UnifiedLine extends DiffLine {
  oldLineNo?: number
  newLineNo?: number
}

// ============================================
// Main Component
// ============================================

export const DiffModal = memo(function DiffModal({
  isOpen,
  onClose,
  diff,
  filePath,
  language,
  diffStats: providedStats,
}: DiffModalProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split')
  
  // 响应式：窄屏自动切换到 unified
  useEffect(() => {
    const checkWidth = () => {
      setViewMode(window.innerWidth >= 1000 ? 'split' : 'unified')
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  // Mount/Unmount 动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
    } else {
      setIsVisible(false)
      const timer = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (shouldRender && isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 10)
      return () => clearTimeout(timer)
    }
  }, [shouldRender, isOpen])

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 解析 diff 数据
  const { before, after } = useMemo(() => {
    if (typeof diff === 'object') {
      return diff
    }
    return extractContentFromUnifiedDiff(diff)
  }, [diff])

  const lang = language || detectLanguage(filePath) || 'text'
  const fileName = filePath?.split(/[/\\]/).pop()

  // 计算统计
  const diffStats = useMemo(() => {
    if (providedStats) return providedStats
    const changes = diffLines(before, after)
    let additions = 0, deletions = 0
    for (const c of changes) {
      if (c.added) additions += c.count || 0
      if (c.removed) deletions += c.count || 0
    }
    return { additions, deletions }
  }, [before, after, providedStats])

  if (!shouldRender) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-bg-000 transition-opacity duration-200"
      style={{ opacity: isVisible ? 1 : 0 }}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-100 bg-bg-100/50 shrink-0">
        <div className="flex items-center gap-4">
          {fileName && (
            <span className="text-text-100 font-mono text-sm font-medium">{fileName}</span>
          )}
          <div className="flex items-center gap-2 text-xs font-mono">
            {diffStats.additions > 0 && (
              <span className="text-success-100">+{diffStats.additions}</span>
            )}
            {diffStats.deletions > 0 && (
              <span className="text-danger-100">−{diffStats.deletions}</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 视图模式切换 */}
          <div className="flex items-center bg-bg-200 rounded-lg p-0.5 text-xs">
            <button
              className={`px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'split' 
                  ? 'bg-bg-000 text-text-100 shadow-sm' 
                  : 'text-text-400 hover:text-text-200'
              }`}
              onClick={() => setViewMode('split')}
            >
              Split
            </button>
            <button
              className={`px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'unified' 
                  ? 'bg-bg-000 text-text-100 shadow-sm' 
                  : 'text-text-400 hover:text-text-200'
              }`}
              onClick={() => setViewMode('unified')}
            >
              Unified
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 text-text-400 hover:text-text-100 hover:bg-bg-200 rounded-md transition-colors"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {viewMode === 'split' ? (
          <SplitDiffView before={before} after={after} language={lang} />
        ) : (
          <UnifiedDiffView before={before} after={after} language={lang} />
        )}
      </div>
    </div>,
    document.body
  )
})

// ============================================
// Split Diff View
// ============================================

interface DiffViewProps {
  before: string
  after: string
  language: string
}

const SplitDiffView = memo(function SplitDiffView({ before, after }: DiffViewProps) {
  const pairedLines = useMemo(() => {
    return computePairedLines(before, after)
  }, [before, after])

  if (pairedLines.length === 0) {
    return <div className="p-8 text-text-400 text-sm text-center">No changes</div>
  }

  return (
    <div className="flex min-h-full">
      {/* Left panel */}
      <div className="flex-1 border-r border-border-100">
        <div className="font-mono text-[13px] leading-6">
          {pairedLines.map((pair, idx) => (
            <div
              key={idx}
              className={`flex ${getLineBgClass(pair.left.type)}`}
            >
              <div className="w-12 shrink-0 px-2 text-right text-text-500 select-none">
                {pair.left.lineNo}
              </div>
              <div className="flex-1 px-3 whitespace-pre-wrap break-all">
                {pair.left.type === 'delete' && (
                  <span className="text-danger-100 select-none mr-1">−</span>
                )}
                {pair.left.type !== 'empty' && (
                  <span 
                    className="text-text-100"
                    dangerouslySetInnerHTML={{ __html: pair.left.highlightedContent || escapeHtml(pair.left.content) }} 
                  />
                )}
                {pair.left.type === 'empty' && <span>&nbsp;</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Right panel */}
      <div className="flex-1">
        <div className="font-mono text-[13px] leading-6">
          {pairedLines.map((pair, idx) => (
            <div
              key={idx}
              className={`flex ${getLineBgClass(pair.right.type)}`}
            >
              <div className="w-12 shrink-0 px-2 text-right text-text-500 select-none">
                {pair.right.lineNo}
              </div>
              <div className="flex-1 px-3 whitespace-pre-wrap break-all">
                {pair.right.type === 'add' && (
                  <span className="text-success-100 select-none mr-1">+</span>
                )}
                {pair.right.type !== 'empty' && (
                  <span 
                    className="text-text-100"
                    dangerouslySetInnerHTML={{ __html: pair.right.highlightedContent || escapeHtml(pair.right.content) }} 
                  />
                )}
                {pair.right.type === 'empty' && <span>&nbsp;</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

// ============================================
// Unified Diff View
// ============================================

const UnifiedDiffView = memo(function UnifiedDiffView({ before, after }: DiffViewProps) {
  const lines = useMemo(() => {
    return computeUnifiedLines(before, after)
  }, [before, after])

  if (lines.length === 0) {
    return <div className="p-8 text-text-400 text-sm text-center">No changes</div>
  }

  return (
    <div className="max-w-5xl mx-auto font-mono text-[13px] leading-6">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={`flex ${getLineBgClass(line.type)}`}
        >
          <div className="w-12 shrink-0 px-2 text-right text-text-500 select-none">
            {line.oldLineNo}
          </div>
          <div className="w-12 shrink-0 px-2 text-right text-text-500 select-none">
            {line.newLineNo}
          </div>
          <div className="flex-1 px-3 whitespace-pre-wrap break-all">
            {line.type === 'add' && (
              <span className="text-success-100 select-none mr-1">+</span>
            )}
            {line.type === 'delete' && (
              <span className="text-danger-100 select-none mr-1">−</span>
            )}
            <span 
              className="text-text-100"
              dangerouslySetInnerHTML={{ __html: line.highlightedContent || escapeHtml(line.content) }} 
            />
          </div>
        </div>
      ))}
    </div>
  )
})

// ============================================
// Helpers
// ============================================

function getLineBgClass(type: LineType): string {
  switch (type) {
    case 'add': return 'bg-success-bg/50'
    case 'delete': return 'bg-danger-bg/50'
    case 'empty': return 'bg-bg-100/30'
    default: return ''
  }
}

function computePairedLines(before: string, after: string): PairedLine[] {
  const changes = diffLines(before, after)
  const result: PairedLine[] = []
  
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  
  let oldIdx = 0
  let newIdx = 0
  let i = 0
  
  while (i < changes.length) {
    const change = changes[i]
    const count = change.count || 0
    
    if (change.removed) {
      const next = changes[i + 1]
      if (next && next.added) {
        const addCount = next.count || 0
        const maxCount = Math.max(count, addCount)
        
        for (let j = 0; j < maxCount; j++) {
          const oldLine = j < count ? beforeLines[oldIdx + j] : undefined
          const newLine = j < addCount ? afterLines[newIdx + j] : undefined
          
          let leftHighlight: string | undefined
          let rightHighlight: string | undefined
          if (oldLine !== undefined && newLine !== undefined) {
             const wordDiff = computeWordDiff(oldLine, newLine)
             if (!isTooFragmented(wordDiff.changes)) {
               leftHighlight = wordDiff.left
               rightHighlight = wordDiff.right
             }
          }
          
          result.push({
            left: oldLine !== undefined 
              ? { type: 'delete', content: oldLine, lineNo: oldIdx + j + 1, highlightedContent: leftHighlight }
              : { type: 'empty', content: '' },
            right: newLine !== undefined
              ? { type: 'add', content: newLine, lineNo: newIdx + j + 1, highlightedContent: rightHighlight }
              : { type: 'empty', content: '' },
          })
        }
        
        oldIdx += count
        newIdx += addCount
        i += 2
        continue
      }
      
      for (let j = 0; j < count; j++) {
        result.push({
          left: { type: 'delete', content: beforeLines[oldIdx + j] || '', lineNo: oldIdx + j + 1 },
          right: { type: 'empty', content: '' },
        })
      }
      oldIdx += count
      
    } else if (change.added) {
      for (let j = 0; j < count; j++) {
        result.push({
          left: { type: 'empty', content: '' },
          right: { type: 'add', content: afterLines[newIdx + j] || '', lineNo: newIdx + j + 1 },
        })
      }
      newIdx += count
      
    } else {
      for (let j = 0; j < count; j++) {
        result.push({
          left: { type: 'context', content: beforeLines[oldIdx + j] || '', lineNo: oldIdx + j + 1 },
          right: { type: 'context', content: afterLines[newIdx + j] || '', lineNo: newIdx + j + 1 },
        })
      }
      oldIdx += count
      newIdx += count
    }
    
    i++
  }
  
  return result
}

function isTooFragmented(changes: any[]): boolean {
  let commonLength = 0
  let totalLength = 0
  
  for (const change of changes) {
    totalLength += change.value.length
    if (!change.added && !change.removed) {
      commonLength += change.value.length
    }
  }
  
  // 如果少于 40% 的内容是相同的，说明这行改动很大，直接整行高亮更好
  if (totalLength > 10 && commonLength / totalLength < 0.4) {
    return true
  }
  
  return false
}

function computeUnifiedLines(before: string, after: string): UnifiedLine[] {
  const changes = diffLines(before, after)
  const result: UnifiedLine[] = []
  
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  
  let oldIdx = 0
  let newIdx = 0
  
  for (const change of changes) {
    const count = change.count || 0
    
    if (change.removed) {
      for (let j = 0; j < count; j++) {
        result.push({
          type: 'delete',
          content: beforeLines[oldIdx + j] || '',
          oldLineNo: oldIdx + j + 1,
        })
      }
      oldIdx += count
    } else if (change.added) {
      for (let j = 0; j < count; j++) {
        result.push({
          type: 'add',
          content: afterLines[newIdx + j] || '',
          newLineNo: newIdx + j + 1,
        })
      }
      newIdx += count
    } else {
      for (let j = 0; j < count; j++) {
        result.push({
          type: 'context',
          content: afterLines[newIdx + j] || '',
          oldLineNo: oldIdx + j + 1,
          newLineNo: newIdx + j + 1,
        })
      }
      oldIdx += count
      newIdx += count
    }
  }
  
  return result
}

function computeWordDiff(oldLine: string, newLine: string): { left: string; right: string; changes: any[] } {
  const changes = diffWords(oldLine, newLine)
  
  // 合并逻辑：将相邻的同类变化或仅隔着空格的变化合并，避免碎片化
  const mergedChanges = []
  for (let i = 0; i < changes.length; i++) {
    const current = changes[i]
    const prev = mergedChanges.length > 0 ? mergedChanges[mergedChanges.length - 1] : null
    
    // 如果当前是纯空格，且前后都是同类变化，则尝试合并
    if (prev && !current.added && !current.removed && /^\s*$/.test(current.value)) {
       const next = i + 1 < changes.length ? changes[i + 1] : null
       if (prev.removed && next && next.removed) {
         prev.value += current.value
         continue 
       }
       if (prev.added && next && next.added) {
         prev.value += current.value
         continue
       }
    }
    
    // 尝试直接合并连续的同类
    if (prev && ((prev.added && current.added) || (prev.removed && current.removed))) {
      prev.value += current.value
    } else {
      mergedChanges.push({...current}) 
    }
  }

  let left = ''
  let right = ''
  
  for (const change of mergedChanges) {
    const escaped = escapeHtml(change.value)
    
    // 移除圆角和内边距，使用纯色背景
    if (change.removed) {
      left += `<span class="bg-danger-100/30">${escaped}</span>`
    } else if (change.added) {
      right += `<span class="bg-success-100/30">${escaped}</span>`
    } else {
      left += escaped
      right += escaped
    }
  }
  
  return { left, right, changes: mergedChanges }
}

function extractContentFromUnifiedDiff(diff: string): { before: string, after: string } {
  let before = '', after = ''
  const lines = diff.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++') || 
        line.startsWith('Index:') || line.startsWith('===') ||
        line.startsWith('@@') || line.startsWith('\\ No newline')) {
      continue
    }
    if (line.startsWith('-')) {
      before += line.slice(1) + '\n'
    } else if (line.startsWith('+')) {
      after += line.slice(1) + '\n'
    } else if (line.startsWith(' ')) {
      before += line.slice(1) + '\n'
      after += line.slice(1) + '\n'
    }
  }
  
  return { before: before.trimEnd(), after: after.trimEnd() }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
