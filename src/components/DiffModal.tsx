/**
 * DiffModal - 全屏 Diff 查看器 (Single File)
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
      <DiffViewer 
        before={before} 
        after={after} 
        language={lang} 
        viewMode={viewMode}
      />
    </div>,
    document.body
  )
})
