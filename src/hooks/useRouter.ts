import { useState, useEffect, useCallback } from 'react'

/**
 * 简单的 hash 路由
 * 格式: #/session/{sessionId} 或 #/ (空)
 */

interface RouteState {
  sessionId: string | null
}

function parseHash(): RouteState {
  const hash = window.location.hash
  
  // 匹配 #/session/{id}
  const sessionMatch = hash.match(/^#\/session\/(.+)$/)
  if (sessionMatch) {
    return { sessionId: sessionMatch[1] }
  }
  
  return { sessionId: null }
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(parseHash)

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash())
    }
    
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // 导航到 session
  const navigateToSession = useCallback((sessionId: string) => {
    window.location.hash = `#/session/${sessionId}`
  }, [])

  // 导航到首页（清空 session）
  const navigateHome = useCallback(() => {
    window.location.hash = '#/'
  }, [])

  // 替换当前路由（不产生历史记录）
  const replaceSession = useCallback((sessionId: string | null) => {
    const newHash = sessionId ? `#/session/${sessionId}` : '#/'
    window.history.replaceState(null, '', newHash)
    setRoute({ sessionId })
  }, [])

  return {
    sessionId: route.sessionId,
    navigateToSession,
    navigateHome,
    replaceSession,
  }
}
