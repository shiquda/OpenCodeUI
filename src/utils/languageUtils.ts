// Language normalization helpers

import { bundledLanguages } from 'shiki'

export function isSupportedLanguage(lang: string): boolean {
  return lang in bundledLanguages
}

export function normalizeLanguage(lang: string): string {
  if (!lang) return 'text'
  
  const aliases: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'tsx',
    'jsx': 'jsx',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'shell': 'bash',
    'zsh': 'bash',
    'yml': 'yaml',
    'md': 'markdown',
    'c++': 'cpp',
    'c#': 'csharp',
    'cs': 'csharp',
    'golang': 'go',
    'rs': 'rust',
    'kt': 'kotlin',
  }
  
  const normalized = aliases[lang.toLowerCase()] || lang.toLowerCase()
  // Check if supported by shiki (if we have the bundle loaded), otherwise fallback to text or keep as is if shiki loads dynamically
  return normalized
}

export function detectLanguage(filePath?: string): string {
  if (!filePath) return 'text'
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
    java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', php: 'php', sh: 'bash', bash: 'bash',
    json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
    html: 'html', css: 'css', scss: 'scss', sql: 'sql',
    xml: 'xml', toml: 'toml', vue: 'vue', svelte: 'svelte'
  }
  return map[ext] || 'text'
}
