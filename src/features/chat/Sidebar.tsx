import { useState, useCallback } from 'react'
import { ActivityBar } from './sidebar/ActivityBar'
import { SidePanel } from './sidebar/SidePanel'
import { ProjectDialog } from './ProjectDialog'
import { useDirectory } from '../../hooks'
import { type ApiSession } from '../../api'

interface SidebarProps {
  isOpen: boolean
  selectedSessionId: string | null
  onSelectSession: (session: ApiSession) => void
  onNewSession: () => void
  onClose: () => void
}

export function Sidebar({
  isOpen,
  selectedSessionId,
  onSelectSession,
  onNewSession,
  onClose,
}: SidebarProps) {
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const { addDirectory, pathInfo } = useDirectory()

  const handleAddProject = useCallback((path: string) => {
    addDirectory(path)
  }, [addDirectory])

  // 如果不打开，渲染为宽度0的占位符
  if (!isOpen) return <div className="w-0 border-r-0 transition-all duration-300" />

  return (
    <>
      <div className="flex h-full transition-all duration-300 bg-bg-000 border-r border-border-200">
        {/* Left: Activity Bar */}
        <ActivityBar onAddClick={() => setIsProjectDialogOpen(true)} />

        {/* Right: Side Panel */}
        <div className="w-64 h-full">
          <SidePanel
            onNewSession={onNewSession}
            onSelectSession={onSelectSession}
            onCloseMobile={onClose}
            selectedSessionId={selectedSessionId}
          />
        </div>
      </div>

      {/* Dialog */}
      <ProjectDialog
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        onSelect={handleAddProject}
        initialPath={pathInfo?.home}
      />
    </>
  )
}
