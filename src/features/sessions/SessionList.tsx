import { useRef, useEffect, useCallback, useState } from 'react'
import { SearchIcon, PencilIcon, TrashIcon } from '../../components/Icons'
import type { ApiSession } from '../../api'

interface SessionListProps {
  sessions: ApiSession[]
  selectedId: string | null
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  search: string
  onSearchChange: (search: string) => void
  onSelect: (session: ApiSession) => void
  onDelete: (sessionId: string) => void
  onRename: (sessionId: string, newTitle: string) => void
  onLoadMore: () => void
  onNewChat: () => void
}

export function SessionList({
  sessions,
  selectedId,
  isLoading,
  isLoadingMore,
  hasMore,
  search,
  onSearchChange,
  onSelect,
  onDelete,
  onRename,
  onLoadMore,
  onNewChat,
}: SessionListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 滚动到底部时加载更多
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el || isLoadingMore || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = el
    // 距离底部 100px 时触发
    if (scrollHeight - scrollTop - clientHeight < 100) {
      onLoadMore()
    }
  }, [isLoadingMore, hasMore, onLoadMore])

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // 自动聚焦搜索框
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 flex-shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-bg-200 border border-border-300/30 rounded-lg py-1.5 pl-8 pr-3 text-sm text-text-100 placeholder:text-text-400 focus:outline-none focus:border-border-300/60 transition-colors"
          />
        </div>
      </div>

      {/* Session List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-text-400">
            <p className="text-sm">
              {search ? 'No sessions found' : 'No sessions yet'}
            </p>
            {!search && (
              <button
                onClick={onNewChat}
                className="mt-2 text-xs text-accent-main-100 hover:underline"
              >
                Start a new session
              </button>
            )}
          </div>
        ) : (
          <>
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isSelected={session.id === selectedId}
                onSelect={() => onSelect(session)}
                onDelete={() => onDelete(session.id)}
                onRename={(newTitle) => onRename(session.id, newTitle)}
              />
            ))}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {!hasMore && sessions.length > 0 && (
              <div className="text-center py-4 text-xs text-text-500">
                No more sessions
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ============================================
// Session Item
// ============================================

interface SessionItemProps {
  session: ApiSession
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newTitle: string) => void
}

function SessionItem({ session, isSelected, onSelect, onDelete, onRename }: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(session.title || '')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this session?')) {
      onDelete()
    }
  }

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTitle(session.title || '')
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditTitle(session.title || '')
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  return (
    <div
      onClick={isEditing ? undefined : onSelect}
      className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-bg-300/70'
          : 'hover:bg-bg-200/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-bg-200 border border-accent-main-100/50 rounded px-1.5 py-0.5 text-sm text-text-100 focus:outline-none focus:border-accent-main-100"
          />
        ) : (
          <p className={`text-sm truncate ${isSelected ? 'text-text-100' : 'text-text-200'}`}>
            {session.title || 'Untitled'}
          </p>
        )}
        <p className="text-xs text-text-500 truncate">
          {formatRelativeTime(session.time.updated)}
          {session.summary && session.summary.files > 0 && (
            <span className="ml-2">
              {session.summary.files} files
              {session.summary.additions > 0 && (
                <span className="text-success-100/70 ml-1">+{session.summary.additions}</span>
              )}
              {session.summary.deletions > 0 && (
                <span className="text-danger-100/70 ml-1">-{session.summary.deletions}</span>
              )}
            </span>
          )}
        </p>
      </div>
      {!isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleStartEdit}
            className="p-1 rounded hover:bg-bg-300 text-text-400 hover:text-text-100 transition-colors"
            title="Rename session"
          >
            <PencilIcon />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-bg-300 text-text-400 hover:text-danger-100 transition-colors"
            title="Delete session"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================
// Helper Functions
// ============================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString()
  } else if (days > 0) {
    return `${days}d ago`
  } else if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return 'Just now'
  }
}

// ============================================
// Loading Spinner
// ============================================

function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  return (
    <svg
      className={`animate-spin text-text-400 ${sizeClass}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
