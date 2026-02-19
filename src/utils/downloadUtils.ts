// ============================================
// 文件下载工具函数
// 支持文本文件和二进制文件（base64）的浏览器端下载
// ============================================

import type { FileContent } from '../api/types'
import { isBinaryContent } from './mimeUtils'

/**
 * 将 base64 字符串转为 Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * 触发浏览器下载
 */
function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // 延迟清理，确保下载已启动
  setTimeout(() => {
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 100)
}

/**
 * 从 FileContent 下载文件
 * - 二进制文件：从 base64 解码后下载
 * - 文本文件：直接以 UTF-8 编码下载
 */
export function downloadFileContent(content: FileContent, fileName: string): void {
  if (isBinaryContent(content.encoding)) {
    // 二进制文件
    const bytes = base64ToBytes(content.content)
    const mimeType = content.mimeType || 'application/octet-stream'
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType })
    triggerDownload(blob, fileName)
  } else {
    // 文本文件
    const mimeType = content.mimeType || 'text/plain'
    const blob = new Blob([content.content], { type: `${mimeType};charset=utf-8` })
    triggerDownload(blob, fileName)
  }
}


