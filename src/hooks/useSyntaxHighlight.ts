import { useState, useEffect } from 'react'
import { codeToHtml, codeToTokens, type BundledTheme } from 'shiki'
import { normalizeLanguage } from '../utils/languageUtils'

export const DEFAULT_THEME: BundledTheme = 'github-dark'

export interface HighlightOptions {
  lang?: string
  theme?: BundledTheme
  enabled?: boolean
}

// Overload for HTML mode (default)
export function useSyntaxHighlight(code: string, options?: HighlightOptions & { mode?: 'html' }): { output: string | null; isLoading: boolean }
// Overload for Tokens mode
export function useSyntaxHighlight(code: string, options: HighlightOptions & { mode: 'tokens' }): { output: any[][] | null; isLoading: boolean }

export function useSyntaxHighlight(code: string, options: HighlightOptions & { mode?: 'html' | 'tokens' } = {}) {
  const { lang = 'text', theme = DEFAULT_THEME, mode = 'html', enabled = true } = options
  const normalizedLang = normalizeLanguage(lang)
  
  const [output, setOutput] = useState<string | any[][] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    
    // Reset immediately to prevent stale content
    setOutput(null)
    setIsLoading(true)

    async function highlight() {
      try {
        if (mode === 'html') {
          const html = await codeToHtml(code, { lang: normalizedLang as any, theme })
          if (!cancelled) setOutput(html)
        } else {
          const result = await codeToTokens(code, { lang: normalizedLang as any, theme })
          if (!cancelled) setOutput(result.tokens)
        }
      } catch (err) {
        console.error('Shiki error:', err)
        if (!cancelled) setOutput(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    highlight()

    return () => { cancelled = true }
  }, [code, normalizedLang, theme, mode, enabled])

  return { output, isLoading }
}
