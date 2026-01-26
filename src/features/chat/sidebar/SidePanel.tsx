import { useCallback, useMemo, useState, useEffect } from 'react'
import { SessionList } from '../../sessions'
import { useDirectory } from '../../../hooks'
import { useSessionContext } from '../../../contexts/SessionContext'
import { updateSession, subscribeToConnectionState, type ApiSession, type ConnectionInfo } from '../../../api'

interface SidePanelProps {
  onNewSession: () => void
  onSelectSession: (session: ApiSession) => void
  onCloseMobile?: () => void
  selectedSessionId: string | null
}

export function SidePanel({
  onNewSession,
  onSelectSession,
  onCloseMobile,
  selectedSessionId,
}: SidePanelProps) {
  const { currentDirectory, savedDirectories } = useDirectory()
  const [connectionState, setConnectionState] = useState<ConnectionInfo | null>(null)
  
  // 监听 SSE 连接状态
  useEffect(() => {
    return subscribeToConnectionState(setConnectionState)
  }, [])
  
  // 使用 SessionContext
  const {
    sessions,
    isLoading,
    isLoadingMore,
    hasMore,
    search,
    setSearch,
    loadMore,
    deleteSession,
    refresh,
  } = useSessionContext()

  const contextName = useMemo(() => {
    if (!currentDirectory) return 'Global'
    const saved = savedDirectories.find(d => d.path === currentDirectory)
    return saved?.name || currentDirectory.split(/[/\\]/).pop() || currentDirectory
  }, [currentDirectory, savedDirectories])

  const handleSelect = useCallback((session: ApiSession) => {
    onSelectSession(session)
    if (window.innerWidth < 768 && onCloseMobile) {
      onCloseMobile()
    }
  }, [onSelectSession, onCloseMobile])

  const handleRename = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      await updateSession(sessionId, { title: newTitle }, currentDirectory)
      refresh()
    } catch (e) {
      console.error(e)
    }
  }, [currentDirectory, refresh])

  return (
    <div className="flex flex-col h-full bg-bg-000 border-r border-border-200">
      {/* Header Info */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-100 truncate" title={contextName}>
            {contextName}
          </h2>
          {/* Connection Status Indicator */}
          <ConnectionIndicator state={connectionState?.state || 'disconnected'} />
        </div>
        <div className="text-[11px] text-text-400 font-mono truncate mt-0.5" title={currentDirectory || 'Global Environment'}>
          {currentDirectory || 'Global Environment'}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-3 flex-shrink-0">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 py-2 bg-accent-main-100 hover:bg-accent-main-200 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
        >
          <PlusIcon />
          <span>New Session</span>
        </button>
      </div>

      {/* Divider */}
      <div className="border-b border-border-200/30" />

      {/* List */}
      <div className="flex-1 overflow-hidden">
        <SessionList
          sessions={sessions}
          selectedId={selectedSessionId}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          onDelete={deleteSession}
          onRename={handleRename}
          onLoadMore={loadMore}
          onNewChat={onNewSession}
        />
      </div>
    </div>
  )
}

// ============================================
// Connection Status Indicator
// ============================================

function ConnectionIndicator({ state }: { state: string }) {
  const colorClass = {
    connected: 'bg-success-100',
    connecting: 'bg-warning-100 animate-pulse',
    disconnected: 'bg-text-500',
    error: 'bg-danger-100',
  }[state] || 'bg-text-500'
  
  const title = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection error',
  }[state] || 'Unknown'

  return (
    <div className="flex items-center gap-1.5" title={title}>
      <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
    </div>
  )
}

// ============================================
// Icons
// ============================================

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
