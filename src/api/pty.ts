// ============================================
// PTY API - 终端管理
// ============================================

import { get, post, put, del, getApiBaseUrl, buildQueryString } from './http'
import { formatPathForApi } from '../utils/directoryUtils'
import type { Pty, PtyCreateParams, PtyUpdateParams } from '../types/api/pty'

/**
 * 获取所有 PTY 会话列表
 */
export async function listPtySessions(directory?: string): Promise<Pty[]> {
  return get<Pty[]>('/pty', { directory: formatPathForApi(directory) })
}

/**
 * 创建新的 PTY 会话
 */
export async function createPtySession(
  params: PtyCreateParams,
  directory?: string
): Promise<Pty> {
  return post<Pty>('/pty', { directory: formatPathForApi(directory) }, params)
}

/**
 * 获取单个 PTY 会话信息
 */
export async function getPtySession(ptyId: string, directory?: string): Promise<Pty> {
  return get<Pty>(`/pty/${ptyId}`, { directory: formatPathForApi(directory) })
}

/**
 * 更新 PTY 会话
 */
export async function updatePtySession(
  ptyId: string,
  params: PtyUpdateParams,
  directory?: string
): Promise<Pty> {
  return put<Pty>(`/pty/${ptyId}`, { directory: formatPathForApi(directory) }, params)
}

/**
 * 删除 PTY 会话
 */
export async function removePtySession(ptyId: string, directory?: string): Promise<boolean> {
  return del<boolean>(`/pty/${ptyId}`, { directory: formatPathForApi(directory) })
}

/**
 * 获取 PTY 连接 WebSocket URL
 * 
 * 动态从当前活动服务器获取地址，支持多后端连接
 */
export function getPtyConnectUrl(ptyId: string, directory?: string): string {
  // 从 HTTP base URL 转换为 WebSocket URL
  const httpBase = getApiBaseUrl()
  // http:// -> ws://, https:// -> wss://
  const wsBase = httpBase.replace(/^http/, 'ws')
  
  const formatted = formatPathForApi(directory)
  const queryString = buildQueryString({ directory: formatted })
  
  return `${wsBase}/pty/${ptyId}/connect${queryString}`
}
