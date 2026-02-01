/**
 * MultiFileDiffModal - Session 多文件 Diff 查看器
 */

import { memo, useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, FileIcon } from './Icons'
import { DiffViewer, type ViewMode } from './DiffViewer'
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

  // 响应式视图模式
  useEffect(() => {
    const checkWidth = () => {
      // 在多文件模式下，侧边栏占据了空间，所以阈值要更大一些
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
    let additions = 0
    let deletions = 0
    diffs.forEach(d => {
      additions += d.additions
      deletions += d.deletions
    })
    return { additions, deletions, files: diffs.length }
  }, [diffs])

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
          <h2 className="text-text-100 font-medium text-sm">Session Changes</h2>
          <div className="flex items-center gap-3 text-xs font-mono text-text-400">
            <span>{stats.files} files</span>
            {(stats.additions > 0 || stats.deletions > 0) && (
              <div className="flex items-center gap-2">
                {stats.additions > 0 && <span className="text-success-100">+{stats.additions}</span>}
                {stats.deletions > 0 && <span className="text-danger-100">−{stats.deletions}</span>}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Switch */}
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
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File List */}
        <div className="w-64 border-r border-border-100 flex flex-col bg-bg-100/30">
          <div className="p-3 border-b border-border-100/50">
            <input 
              type="text" 
              placeholder="Filter files..." 
              className="w-full bg-bg-200 border-none rounded-md px-3 py-1.5 text-xs text-text-100 focus:ring-1 focus:ring-accent-main-100 outline-none placeholder:text-text-400"
            />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            {loading ? (
              <div className="p-4 text-center text-text-400 text-xs">Loading...</div>
            ) : error ? (
              <div className="p-4 text-center text-danger-100 text-xs">{error}</div>
            ) : diffs.length === 0 ? (
              <div className="p-4 text-center text-text-400 text-xs">No changes found</div>
            ) : (
              diffs.map((diff, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-mono flex items-center gap-2 truncate transition-colors ${
                    selectedFileIndex === idx
                      ? 'bg-accent-main-100/10 text-text-100'
                      : 'text-text-300 hover:bg-bg-200 hover:text-text-200'
                  }`}
                >
                  <FileIcon size={14} className={selectedFileIndex === idx ? 'text-accent-main-100' : 'text-text-400'} />
                  <span className="truncate flex-1">{diff.file}</span>
                  {(diff.additions > 0 || diff.deletions > 0) && (
                    <span className={`text-[10px] ${
                      diff.additions > diff.deletions ? 'text-success-100' : 
                      diff.deletions > diff.additions ? 'text-danger-100' : 'text-text-400'
                    }`}>
                      {diff.additions > diff.deletions ? 'M' : 'M'}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Diff View */}
        <div className="flex-1 flex flex-col min-w-0 bg-bg-000">
          {selectedDiff ? (
            <>
              {/* File Info Bar */}
              <div className="px-4 py-2 border-b border-border-100/50 bg-bg-000 flex items-center justify-between">
                <span className="font-mono text-sm text-text-100 truncate">{selectedDiff.file}</span>
                <span className="text-xs text-text-400 font-mono">
                  {selectedDiff.additions > 0 && <span className="text-success-100 mr-2">+{selectedDiff.additions}</span>}
                  {selectedDiff.deletions > 0 && <span className="text-danger-100">−{selectedDiff.deletions}</span>}
                </span>
              </div>
              
              {/* Diff Viewer */}
              <DiffViewer 
                before={selectedDiff.before} 
                after={selectedDiff.after} 
                language={language}
                viewMode={viewMode}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-400 text-sm">
              {loading ? 'Loading changes...' : 'Select a file to view changes'}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
})
