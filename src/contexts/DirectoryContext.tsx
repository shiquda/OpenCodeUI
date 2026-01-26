// ============================================
// DirectoryContext - 管理当前工作目录
// ============================================

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { getPath, type ApiPath } from '../api'

export interface SavedDirectory {
  path: string
  name: string
  addedAt: number
}

export interface DirectoryContextValue {
  /** 当前工作目录（undefined 表示全部/不筛选） */
  currentDirectory: string | undefined
  /** 设置当前工作目录 */
  setCurrentDirectory: (directory: string | undefined) => void
  /** 保存的目录列表 */
  savedDirectories: SavedDirectory[]
  /** 添加目录 */
  addDirectory: (path: string) => void
  /** 移除目录 */
  removeDirectory: (path: string) => void
  /** 服务端路径信息 */
  pathInfo: ApiPath | null
  /** 侧边栏是否展开（桌面端） */
  sidebarExpanded: boolean
  /** 设置侧边栏展开状态 */
  setSidebarExpanded: (expanded: boolean) => void
}

const DirectoryContext = createContext<DirectoryContextValue | null>(null)

const STORAGE_KEY_DIRECTORY = 'opencode-current-directory'
const STORAGE_KEY_SIDEBAR = 'opencode-sidebar-expanded'
const STORAGE_KEY_SAVED = 'opencode-saved-directories'

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [currentDirectory, setCurrentDirectoryState] = useState<string | undefined>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DIRECTORY)
    return saved || undefined
  })
  
  const [savedDirectories, setSavedDirectories] = useState<SavedDirectory[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAVED)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  
  const [sidebarExpanded, setSidebarExpandedState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SIDEBAR)
    return saved !== 'false'
  })
  
  const [pathInfo, setPathInfo] = useState<ApiPath | null>(null)

  // 加载路径信息
  useEffect(() => {
    getPath().then(setPathInfo).catch(console.error)
  }, [])

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(savedDirectories))
  }, [savedDirectories])

  // 设置当前目录
  const setCurrentDirectory = useCallback((directory: string | undefined) => {
    setCurrentDirectoryState(directory)
    if (directory) {
      localStorage.setItem(STORAGE_KEY_DIRECTORY, directory)
    } else {
      localStorage.removeItem(STORAGE_KEY_DIRECTORY)
    }
  }, [])

  // 添加目录
  const addDirectory = useCallback((path: string) => {
    const normalized = path.replace(/\\/g, '/')
    
    if (savedDirectories.some(d => d.path === normalized)) {
      setCurrentDirectory(normalized)
      return
    }
    
    const parts = normalized.split('/').filter(Boolean)
    const name = parts[parts.length - 1] || normalized
    
    const newDir: SavedDirectory = {
      path: normalized,
      name,
      addedAt: Date.now(),
    }
    
    setSavedDirectories(prev => [...prev, newDir])
    setCurrentDirectory(normalized)
  }, [savedDirectories, setCurrentDirectory])

  // 移除目录
  const removeDirectory = useCallback((path: string) => {
    setSavedDirectories(prev => prev.filter(d => d.path !== path))
    if (currentDirectory === path) {
      setCurrentDirectory(undefined)
    }
  }, [currentDirectory, setCurrentDirectory])

  // 设置侧边栏展开
  const setSidebarExpanded = useCallback((expanded: boolean) => {
    setSidebarExpandedState(expanded)
    localStorage.setItem(STORAGE_KEY_SIDEBAR, String(expanded))
  }, [])

  return (
    <DirectoryContext.Provider value={{
      currentDirectory,
      setCurrentDirectory,
      savedDirectories,
      addDirectory,
      removeDirectory,
      pathInfo,
      sidebarExpanded,
      setSidebarExpanded,
    }}>
      {children}
    </DirectoryContext.Provider>
  )
}

export function useDirectory(): DirectoryContextValue {
  const context = useContext(DirectoryContext)
  if (!context) {
    throw new Error('useDirectory must be used within a DirectoryProvider')
  }
  return context
}
