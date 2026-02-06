/**
 * DiffModal - 全屏 Diff 查看器 (Single File)
 * 
 * 使用 Dialog 风格：遮罩 + 居中卡片 + 动画
 */

import { memo, useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { diffLines } from 'diff'
import { CloseIcon } from './Icons'
import { detectLanguage } from '../utils/languageUtils'
import { DiffViewer, extractContentFromUnifiedDiff, type ViewMode } from './DiffViewer'

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
  const [viewMode, setViewMode] = useState<ViewMode>('split')

  // 响应式
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

  // 解析 diff
  const { before, after } = useMemo(() => {
    if (typeof diff === 'object') return diff
    return extractContentFromUnifiedDiff(diff)
  }, [diff])

  const lang = language || detectLanguage(filePath) || 'text'
  const fileName = filePath?.split(/[/\\]/).pop()

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
        backdropFilter: isVisible ? 'blur(4px)' : 'blur(0px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Card */}
      <div
        className="relative bg-bg-000 border border-border-200/60 rounded-xl shadow-2xl flex flex-col overflow-hidden w-full h-full max-w-[96vw] max-h-[92vh] transition-all duration-200 ease-out"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
        }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-100/50 bg-bg-100/30 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            {fileName && (
              <span className="text-text-100 font-mono text-sm font-medium truncate">{fileName}</span>
            )}
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums shrink-0">
              {diffStats.additions > 0 && (
                <span className="text-success-100">+{diffStats.additions}</span>
              )}
              {diffStats.deletions > 0 && (
                <span className="text-danger-100">-{diffStats.deletions}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <ViewModeSwitch viewMode={viewMode} onChange={setViewMode} />
            <button
              onClick={onClose}
              className="p-1.5 text-text-400 hover:text-text-100 hover:bg-bg-200 rounded-lg transition-colors"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        {/* Diff Content */}
        <div className="flex-1 min-h-0">
          <DiffViewer
            before={before}
            after={after}
            language={lang}
            viewMode={viewMode}
          />
        </div>
      </div>
    </div>,
    document.body
  )
})

// ============================================
// ViewModeSwitch - 复用组件
// ============================================

export function ViewModeSwitch({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div className="flex items-center bg-bg-200/80 rounded-lg p-0.5 text-xs">
      <button
        className={`px-2.5 py-1 rounded-md transition-colors ${
          viewMode === 'split'
            ? 'bg-bg-000 text-text-100 shadow-sm'
            : 'text-text-400 hover:text-text-200'
        }`}
        onClick={() => onChange('split')}
      >
        Split
      </button>
      <button
        className={`px-2.5 py-1 rounded-md transition-colors ${
          viewMode === 'unified'
            ? 'bg-bg-000 text-text-100 shadow-sm'
            : 'text-text-400 hover:text-text-200'
        }`}
        onClick={() => onChange('unified')}
      >
        Unified
      </button>
    </div>
  )
}
