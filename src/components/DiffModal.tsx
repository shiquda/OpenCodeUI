/**
 * DiffModal - 全屏 Diff 查看器
 * 
 * 参考 GitHub 风格实现：
 * - Split view: 单表格四列布局，左右同步滚动
 * - Unified view: 传统上下布局
 * - 删除/添加行智能配对
 * - 行内差异高亮
 * - 高斯模糊背景，与整体 UI 风格统一
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ease-out"
      style={{
        backgroundColor: isVisible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        backdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Modal Panel */}
      <div 
        className="relative bg-bg-000 border border-border-200 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ease-out w-full max-w-6xl h-[85vh]"
        style={{ 
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(12px)',
        }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-100/50 shrink-0">
          <div className="flex items-center gap-4">
            {fileName && (
              <span className="text-text-100 font-mono text-sm font-medium">{fileName}</span>
            )}
            <div className="flex items-center gap-2 text-xs font-mono">
              {diffStats.additions > 0 && (
                <span className="text-success-100 bg-success-bg px-1.5 py-0.5 rounded">+{diffStats.additions}</span>
              )}
              {diffStats.deletions > 0 && (
                <span className="text-danger-100 bg-danger-bg px-1.5 py-0.5 rounded">−{diffStats.deletions}</span>
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
              className="p-1.5 text-text-400 hover:text-text-100 hover:bg-bg-100 rounded-md transition-colors"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-bg-100/30">
          {viewMode === 'split' ? (
            <SplitDiffView before={before} after={after} language={lang} />
          ) : (
            <UnifiedDiffView before={before} after={after} language={lang} />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
})

// ============================================
// Split Diff View - GitHub 风格四列布局
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
    return <div className="p-4 text-text-400 text-sm">No changes</div>
  }

  return (
    <table className="w-full border-collapse text-[13px] font-mono leading-5">
      <colgroup>
        <col className="w-12" />
        <col className="w-[calc(50%-24px)]" />
        <col className="w-12" />
        <col className="w-[calc(50%-24px)]" />
      </colgroup>
      <tbody>
        {pairedLines.map((pair, idx) => (
          <tr key={idx} className="border-b border-border-100/50">
            {/* Left side */}
            <td className={`px-2 py-0 text-right text-text-500 select-none align-top border-r border-border-100 ${
              pair.left.type === 'delete' ? 'bg-danger-bg' : ''
            }`}>
              {pair.left.lineNo}
            </td>
            <td className={`px-3 py-0 whitespace-pre-wrap break-all align-top border-r border-border-200 ${
              pair.left.type === 'delete' ? 'bg-danger-bg' : ''
            }`}>
              {pair.left.type === 'delete' && (
                <span className="inline-block w-4 text-danger-100 select-none shrink-0">−</span>
              )}
              {pair.left.type === 'context' && (
                <span className="inline-block w-4 text-text-500 select-none shrink-0"> </span>
              )}
              {pair.left.type !== 'empty' && (
                <span 
                  className="text-text-100"
                  dangerouslySetInnerHTML={{ __html: pair.left.highlightedContent || escapeHtml(pair.left.content) }} 
                />
              )}
            </td>
            
            {/* Right side */}
            <td className={`px-2 py-0 text-right text-text-500 select-none align-top border-r border-border-100 ${
              pair.right.type === 'add' ? 'bg-success-bg' : ''
            }`}>
              {pair.right.lineNo}
            </td>
            <td className={`px-3 py-0 whitespace-pre-wrap break-all align-top ${
              pair.right.type === 'add' ? 'bg-success-bg' : ''
            }`}>
              {pair.right.type === 'add' && (
                <span className="inline-block w-4 text-success-100 select-none shrink-0">+</span>
              )}
              {pair.right.type === 'context' && (
                <span className="inline-block w-4 text-text-500 select-none shrink-0"> </span>
              )}
              {pair.right.type !== 'empty' && (
                <span 
                  className="text-text-100"
                  dangerouslySetInnerHTML={{ __html: pair.right.highlightedContent || escapeHtml(pair.right.content) }} 
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
    return <div className="p-4 text-text-400 text-sm">No changes</div>
  }

  return (
    <div className="max-w-5xl mx-auto">
      <table className="w-full border-collapse text-[13px] font-mono leading-5">
        <colgroup>
          <col className="w-12" />
          <col className="w-12" />
          <col />
        </colgroup>
        <tbody>
          {lines.map((line, idx) => {
            const bgClass = line.type === 'add' ? 'bg-success-bg' :
                           line.type === 'delete' ? 'bg-danger-bg' : ''
            return (
              <tr key={idx} className="border-b border-border-100/50">
                <td className={`px-2 py-0 text-right text-text-500 select-none align-top border-r border-border-100 ${bgClass}`}>
                  {line.type !== 'add' && line.oldLineNo}
                </td>
                <td className={`px-2 py-0 text-right text-text-500 select-none align-top border-r border-border-100 ${bgClass}`}>
                  {line.type !== 'delete' && line.newLineNo}
                </td>
                <td className={`px-3 py-0 whitespace-pre-wrap break-all align-top ${bgClass}`}>
                  {line.type === 'add' && (
                    <span className="inline-block w-4 text-success-100 select-none">+</span>
                  )}
                  {line.type === 'delete' && (
                    <span className="inline-block w-4 text-danger-100 select-none">−</span>
                  )}
                  {line.type === 'context' && (
                    <span className="inline-block w-4 text-text-500 select-none"> </span>
                  )}
                  <span 
                    className="text-text-100"
                    dangerouslySetInnerHTML={{ __html: line.highlightedContent || escapeHtml(line.content) }} 
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

// ============================================
// Diff 计算逻辑
// ============================================

interface UnifiedLine extends DiffLine {
  oldLineNo?: number
  newLineNo?: number
}

/**
 * 计算配对行（用于 Split view）
 * 智能配对相邻的删除/添加行
 */
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
      // 查看下一个是否是 added，可以配对
      const next = changes[i + 1]
      if (next && next.added) {
        const addCount = next.count || 0
        const maxCount = Math.max(count, addCount)
        
        // 配对删除和添加
        for (let j = 0; j < maxCount; j++) {
          const oldLine = j < count ? beforeLines[oldIdx + j] : undefined
          const newLine = j < addCount ? afterLines[newIdx + j] : undefined
          
          // 计算行内差异
          let leftHighlight: string | undefined
          let rightHighlight: string | undefined
          if (oldLine !== undefined && newLine !== undefined) {
            const wordDiff = computeWordDiff(oldLine, newLine)
            leftHighlight = wordDiff.left
            rightHighlight = wordDiff.right
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
        i += 2 // 跳过 added
        continue
      }
      
      // 只有删除，没有配对的添加
      for (let j = 0; j < count; j++) {
        result.push({
          left: { type: 'delete', content: beforeLines[oldIdx + j] || '', lineNo: oldIdx + j + 1 },
          right: { type: 'empty', content: '' },
        })
      }
      oldIdx += count
      
    } else if (change.added) {
      // 只有添加（前面没有删除配对）
      for (let j = 0; j < count; j++) {
        result.push({
          left: { type: 'empty', content: '' },
          right: { type: 'add', content: afterLines[newIdx + j] || '', lineNo: newIdx + j + 1 },
        })
      }
      newIdx += count
      
    } else {
      // 上下文行
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

/**
 * 计算统一视图的行
 */
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

/**
 * 计算行内单词差异，返回带高亮标记的 HTML
 */
function computeWordDiff(oldLine: string, newLine: string): { left: string; right: string } {
  const changes = diffWords(oldLine, newLine)
  
  let left = ''
  let right = ''
  
  for (const change of changes) {
    const escaped = escapeHtml(change.value)
    
    if (change.removed) {
      left += `<span class="bg-danger-100/30 rounded-sm">${escaped}</span>`
    } else if (change.added) {
      right += `<span class="bg-success-100/30 rounded-sm">${escaped}</span>`
    } else {
      left += escaped
      right += escaped
    }
  }
  
  return { left, right }
}

// ============================================
// Helpers
// ============================================

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
