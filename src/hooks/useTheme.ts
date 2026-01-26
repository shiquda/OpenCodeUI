import { useState, useEffect, useCallback } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode')
    return (saved as ThemeMode) || 'system'
  })

  // 获取系统偏好
  const getSystemPreference = useCallback(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [])

  // 实际应用的主题
  const resolvedTheme = mode === 'system' ? getSystemPreference() : mode

  // 应用主题到 DOM
  useEffect(() => {
    const root = document.documentElement
    
    if (mode === 'system') {
      root.removeAttribute('data-mode')
    } else {
      root.setAttribute('data-mode', mode)
    }

    localStorage.setItem('theme-mode', mode)
  }, [mode])

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      // 仅在 system 模式下需要触发重渲染
      if (mode === 'system') {
        // 强制重渲染
        setMode('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [mode])

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode)
  }, [])

  const toggleTheme = useCallback(() => {
    setMode(prev => {
      if (prev === 'system') return 'dark'
      if (prev === 'dark') return 'light'
      return 'system'
    })
  }, [])

  return {
    mode,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
  }
}
