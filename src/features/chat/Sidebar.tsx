import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { SidePanel } from './sidebar/SidePanel'
import { ProjectDialog } from './ProjectDialog'
import { useDirectory } from '../../hooks'
import { CloseIcon } from '../../components/Icons'
import { type ApiSession } from '../../api'

const MIN_WIDTH = 240
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 288  // Claude.ai: 18rem = 288px
const RAIL_WIDTH = 49      // Claude.ai: 3.05rem ≈ 49px

interface SidebarProps {
  isOpen: boolean
  selectedSessionId: string | null
  onSelectSession: (session: ApiSession) => void
  onNewSession: () => void
  onOpen: () => void
  onClose: () => void
}

export const Sidebar = memo(function Sidebar({
  isOpen,
  selectedSessionId,
  onSelectSession,
  onNewSession,
  onOpen,
  onClose,
}: SidebarProps) {
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const { addDirectory, pathInfo } = useDirectory()
  const [isMobile, setIsMobile] = useState(false)
  
  // Resizable state
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-width')
      return saved ? Math.min(Math.max(parseInt(saved), MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH
    } catch {
      return DEFAULT_WIDTH
    }
  })
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleAddProject = useCallback((path: string) => {
    addDirectory(path)
    if (!isMobile) {
      onOpen()
    }
  }, [addDirectory, isMobile, onOpen])

  const openProjectDialog = useCallback(() => {
    setIsProjectDialogOpen(true)
  }, [])

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Resize logic
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH)
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('sidebar-width', width.toString())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, width])
  
  // Save width
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem('sidebar-width', width.toString())
    }
  }, [width, isResizing])

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // 移动端遮罩点击
  const handleBackdropClick = useCallback(() => {
    if (isMobile && isOpen) {
      onClose()
    }
  }, [isMobile, isOpen, onClose])

  const handleToggle = useCallback(() => {
    if (isOpen) {
      onClose()
    } else {
      onOpen()
    }
  }, [isOpen, onClose, onOpen])

  // 动态样式：桌面端收起时显示 rail，展开时显示完整宽度
  const sidebarStyle = isMobile 
    ? { width: `${DEFAULT_WIDTH}px` } 
    : { width: isOpen ? `${width}px` : `${RAIL_WIDTH}px` }

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && (
        <div 
          className={`
            fixed inset-0 bg-black/40 z-30
            transition-opacity duration-300
            ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          onClick={handleBackdropClick}
        />
      )}

      {/* Sidebar Container */}
      <div 
        ref={sidebarRef}
        style={sidebarStyle}
        className={`
          flex flex-col h-full bg-bg-100 overflow-hidden shrink-0
          ${isMobile 
            ? `fixed inset-y-0 left-0 z-40 shadow-xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `relative border-r border-border-200/50 ${isResizing ? 'transition-none' : 'transition-[width] duration-300 ease-out'}`
          }
        `}
      >
        {/* Mobile Header with Close Button */}
        {isMobile && (
          <div className="h-14 flex items-center justify-between px-4 border-b border-border-200/50 shrink-0">
            <span className="text-sm font-medium text-text-100">Menu</span>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-lg text-text-400 hover:text-text-100 hover:bg-bg-200/50 transition-colors"
              aria-label="Close sidebar"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        )}

        {/* Main Content */}
        <SidePanel
          onNewSession={onNewSession}
          onSelectSession={onSelectSession}
          onCloseMobile={onClose}
          selectedSessionId={selectedSessionId}
          onAddProject={openProjectDialog}
          isMobile={isMobile}
          isExpanded={isOpen}
          onToggleSidebar={handleToggle}
        />

        {/* Resizer Handle (Desktop only, when expanded) */}
        {!isMobile && isOpen && (
          <div
            className={`
              absolute top-0 right-0 w-1 h-full cursor-col-resize z-50
              hover:bg-accent-main-100/50 transition-colors
              ${isResizing ? 'bg-accent-main-100' : 'bg-transparent'}
            `}
            onMouseDown={startResizing}
          />
        )}
      </div>

      {/* Project Dialog */}
      <ProjectDialog
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        onSelect={handleAddProject}
        initialPath={pathInfo?.home}
      />
    </>
  )
})
