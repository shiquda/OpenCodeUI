import { useEffect, useRef, useMemo, useCallback, useReducer } from 'react'
import { listDirectory, searchDirectories, getPath, type FileNode, type ApiPath } from '../../api'
import { createPortal } from 'react-dom'

// ============================================
// Types
// ============================================

interface ProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (path: string) => void
  initialPath?: string
}

interface DisplayItem {
  type: 'current' | 'folder' | 'result' | 'quick'
  path: string
  name: string
  icon?: 'home' | 'folder' | 'folder-open' | 'drive' | 'recent'
}

interface State {
  query: string
  currentPath: string
  items: FileNode[]
  searchResults: string[]
  selectedIndex: number
  isLoading: boolean
  error: string | null
  pathInfo: ApiPath | null
  recentPaths: string[]
}

type Action =
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_PATH'; path: string }
  | { type: 'SET_ITEMS'; items: FileNode[] }
  | { type: 'SET_SEARCH_RESULTS'; results: string[] }
  | { type: 'SET_SELECTED_INDEX'; index: number }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_PATH_INFO'; info: ApiPath }
  | { type: 'NAVIGATE_TO'; path: string }
  | { type: 'RESET'; initialPath: string }
  | { type: 'ADD_RECENT'; path: string }

// ============================================
// Utils
// ============================================

const STORAGE_KEY = 'project-dialog-recent'
const MAX_RECENT = 5

function loadRecentPaths(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveRecentPaths(paths: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths.slice(0, MAX_RECENT)))
  } catch { /* ignore */ }
}

// 平台检测
function detectPlatform(): 'windows' | 'unix' {
  // 通过多种方式检测
  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform?.toLowerCase() || ''
    if (platform.includes('win')) return 'windows'
  }
  // 默认假设 Unix
  return 'unix'
}

const platform = detectPlatform()
const isWindows = platform === 'windows'
const pathSep = isWindows ? '\\' : '/'

// 路径处理工具
function normalizePath(p: string): string {
  if (!p) return p
  // 统一分隔符
  return isWindows ? p.replace(/\//g, '\\') : p.replace(/\\/g, '/')
}

function joinPath(base: string, name: string): string {
  if (!base) return name
  const normalized = normalizePath(base)
  if (normalized.endsWith(pathSep)) {
    return normalized + name
  }
  return normalized + pathSep + name
}

function getParentPath(p: string): string | null {
  const normalized = normalizePath(p)
  
  // Windows 根目录 (C:\)
  if (isWindows && /^[a-zA-Z]:\\?$/.test(normalized)) {
    return null
  }
  
  // Unix 根目录
  if (!isWindows && normalized === '/') {
    return null
  }
  
  const lastSep = normalized.lastIndexOf(pathSep)
  if (lastSep <= 0) {
    // Unix: /foo -> /
    if (!isWindows && normalized.startsWith('/')) return '/'
    return null
  }
  
  // Windows: C:\foo -> C:\
  if (isWindows && lastSep === 2 && /^[a-zA-Z]:/.test(normalized)) {
    return normalized.substring(0, 3)
  }
  
  return normalized.substring(0, lastSep)
}

function isAbsolutePath(p: string): boolean {
  if (!p) return false
  if (isWindows) {
    return /^[a-zA-Z]:/.test(p)
  }
  return p.startsWith('/')
}

function getPathParts(p: string): string[] {
  if (!p) return []
  const normalized = normalizePath(p)
  const parts = normalized.split(pathSep).filter(Boolean)
  
  // Windows: 保留盘符
  if (isWindows && parts.length > 0 && /^[a-zA-Z]:$/.test(parts[0])) {
    parts[0] = parts[0] + pathSep
  }
  // Unix: 保留根目录
  if (!isWindows && normalized.startsWith('/')) {
    parts.unshift('/')
  }
  
  return parts
}

function buildPathFromParts(parts: string[], index: number): string {
  if (index < 0) return ''
  
  const selected = parts.slice(0, index + 1)
  
  // Unix 根目录
  if (!isWindows && selected.length === 1 && selected[0] === '/') {
    return '/'
  }
  
  // Windows 盘符
  if (isWindows && selected.length === 1 && /^[a-zA-Z]:\\$/.test(selected[0])) {
    return selected[0]
  }
  
  return selected.join(pathSep).replace(/^\/\\/, '/').replace(/\\\\/g, '\\')
}

// ============================================
// Reducer
// ============================================

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, query: action.query, selectedIndex: 0 }
    case 'SET_PATH':
      return { ...state, currentPath: action.path }
    case 'SET_ITEMS':
      return { ...state, items: action.items, searchResults: [], error: null }
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.results, error: null }
    case 'SET_SELECTED_INDEX':
      return { ...state, selectedIndex: action.index }
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading }
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false }
    case 'SET_PATH_INFO':
      return { ...state, pathInfo: action.info }
    case 'NAVIGATE_TO':
      return { ...state, currentPath: action.path, query: '', selectedIndex: 0 }
    case 'RESET':
      return {
        ...state,
        query: '',
        currentPath: action.initialPath,
        selectedIndex: 0,
        error: null,
        items: [],
        searchResults: [],
      }
    case 'ADD_RECENT': {
      const filtered = state.recentPaths.filter(p => p !== action.path)
      const updated = [action.path, ...filtered].slice(0, MAX_RECENT)
      saveRecentPaths(updated)
      return { ...state, recentPaths: updated }
    }
    default:
      return state
  }
}

function createInitialState(initialPath: string): State {
  return {
    query: '',
    currentPath: initialPath,
    items: [],
    searchResults: [],
    selectedIndex: 0,
    isLoading: false,
    error: null,
    pathInfo: null,
    recentPaths: loadRecentPaths(),
  }
}

// ============================================
// Component
// ============================================

export function ProjectDialog({ isOpen, onClose, onSelect, initialPath = '' }: ProjectDialogProps) {
  const [state, dispatch] = useReducer(reducer, initialPath, createInitialState)
  const { query, currentPath, items, searchResults, selectedIndex, isLoading, error, pathInfo, recentPaths } = state
  
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 获取系统路径信息
  useEffect(() => {
    if (isOpen && !pathInfo) {
      getPath()
        .then(info => dispatch({ type: 'SET_PATH_INFO', info }))
        .catch(console.error)
    }
  }, [isOpen, pathInfo])

  // 初始化
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET', initialPath: normalizePath(initialPath) })
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, initialPath])

  // 加载目录内容
  useEffect(() => {
    if (!isOpen) return

    const normalizedQuery = normalizePath(query)
    
    // 1. 绝对路径输入 - 直接列出该路径
    if (isAbsolutePath(normalizedQuery)) {
      dispatch({ type: 'SET_LOADING', loading: true })
      listDirectory(normalizedQuery)
        .then(nodes => {
          const dirs = nodes
            .filter(n => n.type === 'directory')
            .sort((a, b) => a.name.localeCompare(b.name))
          dispatch({ type: 'SET_ITEMS', items: dirs })
        })
        .catch(err => dispatch({ type: 'SET_ERROR', error: err.message }))
        .finally(() => dispatch({ type: 'SET_LOADING', loading: false }))
      return
    }
    
    // 2. 搜索模式
    if (normalizedQuery.trim().length > 0) {
      dispatch({ type: 'SET_LOADING', loading: true })
      const timer = setTimeout(async () => {
        try {
          const results = await searchDirectories(normalizedQuery, currentPath, 20)
          dispatch({ type: 'SET_SEARCH_RESULTS', results })
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: e instanceof Error ? e.message : 'Search failed' })
        } finally {
          dispatch({ type: 'SET_LOADING', loading: false })
        }
      }, 200)
      return () => clearTimeout(timer)
    }
    
    // 3. 浏览模式
    dispatch({ type: 'SET_LOADING', loading: true })
    listDirectory(currentPath)
      .then(nodes => {
        const dirs = nodes
          .filter(n => n.type === 'directory')
          .sort((a, b) => a.name.localeCompare(b.name))
        dispatch({ type: 'SET_ITEMS', items: dirs })
      })
      .catch(err => dispatch({ type: 'SET_ERROR', error: err.message }))
      .finally(() => dispatch({ type: 'SET_LOADING', loading: false }))
  }, [isOpen, currentPath, query])

  // 滚动选中项到可视区域
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // 构建显示列表
  const displayItems = useMemo<DisplayItem[]>(() => {
    const list: DisplayItem[] = []
    const isSearching = searchResults.length > 0
    const isAbsInput = isAbsolutePath(query)
    
    // 快捷入口 (仅在浏览模式且无搜索时显示)
    if (!isSearching && !isAbsInput && !query.trim()) {
      // Home 目录
      if (pathInfo?.home) {
        list.push({
          type: 'quick',
          path: normalizePath(pathInfo.home),
          name: 'Home',
          icon: 'home',
        })
      }
      
      // 最近访问
      recentPaths.slice(0, 3).forEach(p => {
        if (p !== currentPath && p !== pathInfo?.home) {
          const parts = getPathParts(p)
          list.push({
            type: 'quick',
            path: p,
            name: parts[parts.length - 1] || p,
            icon: 'recent',
          })
        }
      })
    }
    
    // 当前目录选择项 (非绝对路径输入时)
    if (!isAbsInput && currentPath) {
      list.push({
        type: 'current',
        path: currentPath,
        name: '选择当前目录',
        icon: 'folder-open',
      })
    }
    
    // 搜索结果或目录列表
    if (isSearching) {
      list.push(...searchResults.map(path => ({
        type: 'result' as const,
        path,
        name: path,
        icon: 'folder' as const,
      })))
    } else {
      list.push(...items.map(node => ({
        type: 'folder' as const,
        path: joinPath(currentPath, node.name),
        name: node.name,
        icon: 'folder' as const,
      })))
    }
    
    return list
  }, [items, searchResults, currentPath, query, pathInfo, recentPaths])

  // 导航到目录
  const navigateTo = useCallback((path: string) => {
    dispatch({ type: 'NAVIGATE_TO', path: normalizePath(path) })
  }, [])

  // 选择目录
  const selectPath = useCallback((path: string) => {
    dispatch({ type: 'ADD_RECENT', path })
    onSelect(path)
    onClose()
  }, [onSelect, onClose])

  // 返回上级目录
  const goUp = useCallback(() => {
    const parent = getParentPath(currentPath)
    if (parent !== null) {
      navigateTo(parent)
    }
  }, [currentPath, navigateTo])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const total = displayItems.length
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (total > 0) {
          dispatch({ type: 'SET_SELECTED_INDEX', index: (selectedIndex + 1) % total })
        }
        break
        
      case 'ArrowUp':
        e.preventDefault()
        if (total > 0) {
          dispatch({ type: 'SET_SELECTED_INDEX', index: (selectedIndex - 1 + total) % total })
        }
        break
        
      case 'Tab':
        // Tab 进入目录 (和 → 相同效果)
        e.preventDefault()
        if (total > 0) {
          const item = displayItems[selectedIndex]
          if (item.type === 'folder' || item.type === 'result' || item.type === 'quick') {
            navigateTo(item.path)
          }
        }
        break
        
      case 'Enter':
        e.preventDefault()
        // Ctrl+Enter 或 Cmd+Enter: 选择当前选中项
        if (e.ctrlKey || e.metaKey) {
          if (total > 0) {
            selectPath(displayItems[selectedIndex].path)
          }
          return
        }
        
        // 普通 Enter:
        // - 如果是绝对路径输入，选择该路径
        // - 如果选中的是 'current'，选择当前目录
        // - 否则进入目录
        const normalizedQuery = normalizePath(query)
        if (isAbsolutePath(normalizedQuery) && normalizedQuery.length > 1) {
          selectPath(normalizedQuery)
          return
        }
        
        if (total === 0) return
        
        const item = displayItems[selectedIndex]
        if (item.type === 'current') {
          selectPath(item.path)
        } else {
          navigateTo(item.path)
        }
        break
        
      case 'Backspace':
        // 输入框为空时，返回上级目录
        if (!query) {
          e.preventDefault()
          goUp()
        }
        break
        
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [displayItems, selectedIndex, query, navigateTo, selectPath, goUp, onClose])

  // 处理列表项点击
  const handleItemClick = useCallback((item: DisplayItem, e: React.MouseEvent) => {
    // Ctrl+Click 或双击选择
    if (e.ctrlKey || e.metaKey || e.detail === 2) {
      selectPath(item.path)
      return
    }
    
    // 单击进入目录
    if (item.type === 'current') {
      selectPath(item.path)
    } else {
      navigateTo(item.path)
    }
  }, [navigateTo, selectPath])

  // 面包屑导航
  const pathParts = useMemo(() => getPathParts(currentPath), [currentPath])
  
  const handleBreadcrumbClick = useCallback((index: number) => {
    const path = buildPathFromParts(pathParts, index)
    navigateTo(path)
  }, [pathParts, navigateTo])

  if (!isOpen) return null

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm transition-opacity" 
      onClick={onClose}
    >
      <div 
        className="w-[640px] max-w-[90vw] bg-bg-000 rounded-xl shadow-2xl border border-border-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - 面包屑导航 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-200 bg-bg-100">
          <button 
            onClick={goUp} 
            disabled={getParentPath(currentPath) === null}
            className="p-1.5 hover:bg-bg-200 rounded text-text-400 hover:text-text-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
            title="返回上级 (Backspace)"
          >
            <ArrowUpIcon />
          </button>
          
          {/* 面包屑 */}
          <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none">
            {pathParts.length === 0 ? (
              <span className="text-sm text-text-400">/</span>
            ) : (
              pathParts.map((part, i) => (
                <span key={i} className="flex items-center shrink-0">
                  {i > 0 && <ChevronRightIcon className="text-text-500 mx-0.5" />}
                  <button
                    onClick={() => handleBreadcrumbClick(i)}
                    className={`text-sm px-1.5 py-0.5 rounded hover:bg-bg-200 transition-colors ${
                      i === pathParts.length - 1 ? 'text-text-100 font-medium' : 'text-text-300'
                    }`}
                  >
                    {part}
                  </button>
                </span>
              ))
            )}
          </div>
          
          <button onClick={onClose} className="text-text-400 hover:text-text-200 p-1 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* 搜索输入框 */}
        <div className="p-3 border-b border-border-200">
          <div className="relative group">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => dispatch({ type: 'SET_QUERY', query: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder={isWindows ? "搜索或输入路径 (如 C:\\Users\\...)" : "搜索或输入路径 (如 /home/...)"}
              className="w-full bg-bg-200 text-text-100 text-sm rounded-lg py-2.5 pl-10 pr-4 outline-none border border-transparent focus:border-accent-main-100 transition-all placeholder:text-text-400"
            />
          </div>
        </div>

        {/* 目录列表 */}
        <div ref={listRef} className="flex-1 overflow-y-auto max-h-[400px] min-h-[300px] p-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-8 text-text-400">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 text-sm mb-2">加载失败</div>
              <div className="text-text-500 text-xs">{error}</div>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-12 text-text-400 text-sm">
              {query.trim() ? '没有找到匹配的文件夹' : '空文件夹'}
            </div>
          ) : (
            displayItems.map((item, index) => {
              const isSelected = index === selectedIndex
              
              // 快捷入口样式
              if (item.type === 'quick') {
                return (
                  <div
                    key={`quick-${item.path}`}
                    onClick={e => handleItemClick(item, e)}
                    onMouseEnter={() => dispatch({ type: 'SET_SELECTED_INDEX', index })}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                      isSelected 
                        ? 'bg-bg-200 text-text-100' 
                        : 'text-text-300 hover:bg-bg-100'
                    }`}
                  >
                    <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-center ${isSelected ? 'text-accent-main-100' : 'text-text-400'}`}>
                      {item.icon === 'home' ? <HomeIcon /> : <ClockIcon />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{item.name}</div>
                      <div className="text-xs text-text-500 truncate">{item.path}</div>
                    </div>
                    <span className="text-[10px] text-text-500 uppercase tracking-wider">
                      {item.icon === 'home' ? 'Home' : '最近'}
                    </span>
                  </div>
                )
              }
              
              // 当前目录选择项
              if (item.type === 'current') {
                return (
                  <div
                    key="current"
                    onClick={e => handleItemClick(item, e)}
                    onMouseEnter={() => dispatch({ type: 'SET_SELECTED_INDEX', index })}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer mb-2 border transition-colors ${
                      isSelected 
                        ? 'bg-accent-main-100 text-white border-accent-main-100' 
                        : 'bg-accent-main-100/5 text-accent-main-100 border-accent-main-100/20 hover:bg-accent-main-100/10'
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      <FolderOpenIcon />
                    </div>
                    <span className="text-sm font-medium flex-1">{item.name}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-70 flex items-center gap-1">
                      <span className="opacity-50">Enter</span>
                    </span>
                  </div>
                )
              }

              // 普通文件夹
              return (
                <div
                  key={item.path}
                  onClick={e => handleItemClick(item, e)}
                  onMouseEnter={() => dispatch({ type: 'SET_SELECTED_INDEX', index })}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                    isSelected 
                      ? 'bg-accent-main-100 text-white' 
                      : 'text-text-200 hover:bg-bg-100'
                  }`}
                >
                  <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-center ${isSelected ? 'text-white' : 'text-text-400'}`}>
                    <FolderIcon />
                  </div>
                  <div className="flex-1 min-w-0 text-sm truncate" title={item.path}>
                    {item.type === 'result' ? item.path : item.name}
                  </div>
                  {isSelected && (
                    <span className="text-xs opacity-60 flex items-center gap-1">
                      <span>Tab</span>
                      <span className="opacity-50">进入</span>
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
        
        {/* Footer - 快捷键提示 */}
        <div className="px-4 py-2 border-t border-border-200 flex justify-between text-[11px] text-text-400 bg-bg-100">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd>
              <Kbd>Tab</Kbd>
              进入
            </span>
            <span className="flex items-center gap-1">
              <Kbd>{isWindows ? 'Ctrl' : '⌘'}+Enter</Kbd>
              选择
            </span>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <Kbd>Backspace</Kbd>
              返回
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd>
              关闭
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================
// Icons & Components
// ============================================

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-bg-200 px-1.5 py-0.5 rounded border border-border-300 font-mono text-[10px]">
      {children}
    </span>
  )
}

function CloseIcon() { 
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ) 
}

function SearchIcon({ className }: { className?: string }) { 
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  ) 
}

function FolderIcon() { 
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  ) 
}

function FolderOpenIcon() { 
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
    </svg>
  ) 
}

function ArrowUpIcon() { 
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  ) 
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  )
}

function LoadingSpinner() { 
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10"/>
    </svg>
  ) 
}
