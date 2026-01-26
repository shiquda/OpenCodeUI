// ============================================
// File Search API Functions
// ============================================

import {
  API_BASE,
  type FileNode,
  type SymbolInfo,
} from './types'

/**
 * 搜索文件或目录
 * @param query 搜索关键词
 * @param options.directory 工作目录（项目目录）
 * @param options.type 搜索类型：file 或 directory
 * @param options.limit 返回结果数量限制
 */
export async function searchFiles(
  query: string,
  options: {
    directory?: string
    type?: 'file' | 'directory'
    limit?: number
  } = {}
): Promise<string[]> {
  const params = new URLSearchParams()
  params.set('query', query)
  if (options.directory) params.set('directory', options.directory)
  if (options.type) params.set('type', options.type)
  if (options.limit) params.set('limit', String(options.limit))

  const response = await fetch(`${API_BASE}/find/file?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to search files: ${response.status}`)
  }

  return response.json()
}

/**
 * 列出目录内容
 * @param path 要列出的路径
 * @param directory 工作目录（项目目录）
 */
export async function listDirectory(path: string, directory?: string): Promise<FileNode[]> {
  const params = new URLSearchParams()
  
  // 智能处理：如果 path 是绝对路径，将其作为 directory 传递，path 设为空
  // Windows: C: 或 C:/ 开头
  // Unix: / 开头
  const isAbsolute = /^[a-zA-Z]:/.test(path) || path.startsWith('/')
  
  if (isAbsolute && !directory) {
    params.set('directory', path)
    params.set('path', '')
  } else {
    params.set('path', path)
    if (directory) params.set('directory', directory)
  }

  const response = await fetch(`${API_BASE}/file?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to list directory: ${response.status}`)
  }

  return response.json()
}

/**
 * 搜索代码符号
 * @param query 搜索关键词
 * @param directory 工作目录（项目目录）
 */
export async function searchSymbols(query: string, directory?: string): Promise<SymbolInfo[]> {
  const params = new URLSearchParams()
  params.set('query', query)
  if (directory) params.set('directory', directory)

  const response = await fetch(`${API_BASE}/find/symbol?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to search symbols: ${response.status}`)
  }

  return response.json()
}

/**
 * 搜索目录（便捷方法）
 * @param query 搜索关键词
 * @param baseDirectory 基础目录（从哪里开始搜索）
 * @param limit 返回结果数量限制
 */
export async function searchDirectories(
  query: string,
  baseDirectory?: string,
  limit: number = 50
): Promise<string[]> {
  return searchFiles(query, {
    directory: baseDirectory,
    type: 'directory',
    limit,
  })
}
