/**
 * MultiFileDiffModal - Session 多文件 Diff 查看器
 * 
 * Dialog 风格：遮罩 + 居中卡片 + 左侧文件列表 + 右侧 Diff
 */

import { memo, useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, FileIcon } from './Icons'
import { DiffViewer, type ViewMode } from './DiffViewer'
import { ViewModeSwitch } from './DiffModal'
import { getSessionDiff } from '../api/session'
import type { FileDiff } from '../api/types'
import { detectLanguage } from '../utils/languageUtils'

// ============================================
// Types
// ============================================

interface MultiFileDiffModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

// ============================================
// Main Component
// ============================================

export const MultiFileDiffModal = memo(function MultiFileDiffModal({
  isOpen,
  onClose,
  sessionId,
}: MultiFileDiffModalProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const [loading, setLoading] = useState(false)
  const [diffs, setDiffs] = useState<FileDiff[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  // 响应式
  useEffect(() => {
    const checkWidth = () => {
      setViewMode(window.innerWidth >= 1200 ? 'split' : 'unified')
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  // 加载数据
  useEffect(() => {
    if (isOpen && sessionId) {
      setLoading(true)
      setError(null)
      getSessionDiff(sessionId)
        .then(data => {
          setDiffs(data)
          if (data.length > 0) setSelectedFileIndex(0)
        })
        .catch(err => {
          console.error('Failed to load session diff:', err)
          setError('Failed to load changes')
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, sessionId])

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

  const selectedDiff = diffs[selectedFileIndex]
  const language = selectedDiff ? detectLanguage(selectedDiff.file) || 'text' : 'text'

  const stats = useMemo(() => {
    let additions = 0, deletions = 0
    diffs.forEach(d => { additions += d.additions; deletions += d.deletions })
    return { additions, deletions, files: diffs.length }
  }, [diffs])

  const filteredDiffs = useMemo(() => {
    if (!filter) return diffs.map((d, i) => ({ diff: d, index: i }))
    const lower = filter.toLowerCase()
    return diffs
      .map((d, i) => ({ diff: d, index: i }))
      .filter(({ diff: d }) => d.file.toLowerCase().includes(lower))
  }, [diffs, filter])

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
            <h2 className="text-text-100 font-medium text-sm">Session Changes</h2>
            <div className="flex items-center gap-3 text-xs font-mono text-text-400 tabular-nums shrink-0">
              <span>{stats.files} file{stats.files !== 1 ? 's' : ''}</span>
              {(stats.additions > 0 || stats.deletions > 0) && (
                <div className="flex items-center gap-2">
                  {stats.additions > 0 && <span className="text-success-100">+{stats.additions}</span>}
                  {stats.deletions > 0 && <span className="text-danger-100">-{stats.deletions}</span>}
                </div>
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

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Sidebar - File List */}
          <div className="w-60 border-r border-border-100/50 flex flex-col bg-bg-100/20 shrink-0">
            <div className="p-2.5 border-b border-border-100/30">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter files..."
                className="w-full bg-bg-200/60 border border-border-200/30 rounded-lg px-2.5 py-1.5 text-xs text-text-100 focus:outline-none focus:border-accent-main-100/40 placeholder:text-text-500 transition-colors"
              />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-px">
              {loading ? (
                <div className="p-4 text-center text-text-400 text-xs">Loading...</div>
              ) : error ? (
                <div className="p-4 text-center text-danger-100 text-xs">{error}</div>
              ) : filteredDiffs.length === 0 ? (
                <div className="p-4 text-center text-text-400 text-xs">
                  {filter ? 'No matching files' : 'No changes found'}
                </div>
              ) : (
                filteredDiffs.map(({ diff: d, index: idx }) => {
                  const name = d.file.split(/[/\\]/).pop() || d.file
                  const dir = d.file.includes('/') || d.file.includes('\\')
                    ? d.file.slice(0, d.file.length - name.length - 1)
                    : ''
                  const isSelected = selectedFileIndex === idx

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedFileIndex(idx)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                        isSelected
                          ? 'bg-accent-main-100/10 text-text-100'
                          : 'text-text-300 hover:bg-bg-200/60 hover:text-text-200'
                      }`}
                    >
                      <FileIcon
                        size={13}
                        className={isSelected ? 'text-accent-main-100 shrink-0' : 'text-text-500 shrink-0'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono truncate">{name}</div>
                        {dir && (
                          <div className="text-[10px] text-text-500 font-mono truncate">{dir}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums shrink-0">
                        {d.additions > 0 && <span className="text-success-100">+{d.additions}</span>}
                        {d.deletions > 0 && <span className="text-danger-100">-{d.deletions}</span>}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Main Diff View */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedDiff ? (
              <>
                {/* File path bar */}
                <div className="px-4 py-2 border-b border-border-100/30 bg-bg-100/10 flex items-center justify-between shrink-0">
                  <span className="font-mono text-xs text-text-200 truncate">{selectedDiff.file}</span>
                  <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums shrink-0">
                    {selectedDiff.additions > 0 && <span className="text-success-100">+{selectedDiff.additions}</span>}
                    {selectedDiff.deletions > 0 && <span className="text-danger-100">-{selectedDiff.deletions}</span>}
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <DiffViewer
                    before={selectedDiff.before}
                    after={selectedDiff.after}
                    language={language}
                    viewMode={viewMode}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-400 text-xs">
                {loading ? 'Loading changes...' : 'Select a file to view changes'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
})
