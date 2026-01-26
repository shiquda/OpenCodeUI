import { useState, useRef, useEffect } from 'react'
import type { ApiProject } from '../../api'

interface ProjectSelectorProps {
  currentProject: ApiProject | null
  projects: ApiProject[]
  isLoading: boolean
  onSelectProject: (projectId: string) => void
}

export function ProjectSelector({
  currentProject,
  projects,
  isLoading,
  onSelectProject,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 获取显示名称
  const getDisplayName = (project: ApiProject | null) => {
    if (!project) return isLoading ? 'Loading...' : 'No project'
    
    // 优先用 name
    if (project.name) return project.name
    
    // 如果是 global，显示 "Global"
    if (project.id === 'global') return 'Global'
    
    // 否则显示目录名
    const worktree = project.worktree
    // 提取最后一个目录名
    const parts = worktree.replace(/\\/g, '/').split('/').filter(Boolean)
    return parts[parts.length - 1] || worktree
  }

  // 获取完整路径（用于 tooltip）
  const getFullPath = (project: ApiProject | null) => {
    if (!project) return ''
    return project.worktree
  }

  // 过滤掉当前选中的 project
  const otherProjects = projects.filter(p => p.id !== currentProject?.id)

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-200/50 transition-colors rounded-lg"
        title={getFullPath(currentProject)}
      >
        {/* Project Icon */}
        <div 
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ 
            backgroundColor: currentProject?.icon?.color 
              ? getColorValue(currentProject.icon.color) 
              : '#6366f1' 
          }}
        >
          <FolderIcon className="text-white w-3.5 h-3.5" />
        </div>
        
        {/* Project Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-100 truncate">
            {getDisplayName(currentProject)}
          </p>
          <p className="text-xs text-text-500 truncate">
            {getFullPath(currentProject)}
          </p>
        </div>

        {/* Chevron */}
        {projects.length > 1 && (
          <ChevronIcon className={`text-text-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && otherProjects.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-100 border border-border-300/30 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {otherProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  onSelectProject(project.id)
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-200/50 transition-colors"
                title={project.worktree}
              >
                <div 
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: project.icon?.color 
                      ? getColorValue(project.icon.color) 
                      : '#6366f1' 
                  }}
                >
                  <FolderIcon className="text-white w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-200 truncate">
                    {getDisplayName(project)}
                  </p>
                  <p className="text-xs text-text-500 truncate">
                    {project.worktree}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 颜色名称到实际值的映射
function getColorValue(colorName: string): string {
  const colors: Record<string, string> = {
    red: '#ef4444',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#eab308',
    lime: '#84cc16',
    green: '#22c55e',
    emerald: '#10b981',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    sky: '#0ea5e9',
    blue: '#3b82f6',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    purple: '#a855f7',
    fuchsia: '#d946ef',
    pink: '#ec4899',
    rose: '#f43f5e',
  }
  return colors[colorName] || colorName
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
