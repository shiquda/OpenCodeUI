// ============================================
// usePermissionHandler - Permission & Question 处理 (Enhanced)
// ============================================

import { useState, useCallback, useRef } from 'react'
import {
  replyPermission,
  replyQuestion,
  rejectQuestion,
  getPendingPermissions,
  getPendingQuestions,
  type ApiPermissionRequest,
  type ApiQuestionRequest,
  type PermissionReply,
  type QuestionAnswer,
} from '../api'

export interface UsePermissionHandlerResult {
  // State
  pendingPermissionRequests: ApiPermissionRequest[]
  pendingQuestionRequests: ApiQuestionRequest[]
  // Setters (for SSE events)
  setPendingPermissionRequests: React.Dispatch<React.SetStateAction<ApiPermissionRequest[]>>
  setPendingQuestionRequests: React.Dispatch<React.SetStateAction<ApiQuestionRequest[]>>
  // Handlers
  handlePermissionReply: (requestId: string, reply: PermissionReply, directory?: string) => Promise<boolean>
  handleQuestionReply: (requestId: string, answers: QuestionAnswer[], directory?: string) => Promise<boolean>
  handleQuestionReject: (requestId: string, directory?: string) => Promise<boolean>
  // Refresh (poll for pending requests)
  refreshPendingRequests: (sessionId?: string, directory?: string) => Promise<void>
  // Reset
  resetPendingRequests: () => void
  // Loading state
  isReplying: boolean
}

const MAX_RETRIES = 3
const RETRY_DELAY = 500

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  let lastError: Error | undefined
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[Permission] Attempt ${i + 1} failed:`, lastError.message)
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
      }
    }
  }
  
  throw lastError
}

export function usePermissionHandler(): UsePermissionHandlerResult {
  const [pendingPermissionRequests, setPendingPermissionRequests] = useState<ApiPermissionRequest[]>([])
  const [pendingQuestionRequests, setPendingQuestionRequests] = useState<ApiQuestionRequest[]>([])
  const [isReplying, setIsReplying] = useState(false)
  
  // 防止重复回复
  const replyingIdsRef = useRef<Set<string>>(new Set())

  const handlePermissionReply = useCallback(async (
    requestId: string, 
    reply: PermissionReply,
    directory?: string
  ): Promise<boolean> => {
    // 防止重复回复
    if (replyingIdsRef.current.has(requestId)) {
      console.warn(`[Permission] Already replying to ${requestId}`)
      return false
    }
    
    replyingIdsRef.current.add(requestId)
    setIsReplying(true)
    
    try {
      await withRetry(() => replyPermission(requestId, reply, undefined, directory))
      
      // 成功后从列表移除
      setPendingPermissionRequests(prev => prev.filter(r => r.id !== requestId))
      console.log(`[Permission] Replied ${reply} to ${requestId}`)
      return true
    } catch (error) {
      console.error('[Permission] Failed to reply after retries:', error)
      
      // 即使失败也从列表移除，避免卡住 UI
      // 用户可以通过刷新重新获取
      setPendingPermissionRequests(prev => prev.filter(r => r.id !== requestId))
      return false
    } finally {
      replyingIdsRef.current.delete(requestId)
      setIsReplying(false)
    }
  }, [])

  const handleQuestionReply = useCallback(async (
    requestId: string, 
    answers: QuestionAnswer[],
    directory?: string
  ): Promise<boolean> => {
    if (replyingIdsRef.current.has(requestId)) {
      console.warn(`[Question] Already replying to ${requestId}`)
      return false
    }
    
    replyingIdsRef.current.add(requestId)
    setIsReplying(true)
    
    try {
      await withRetry(() => replyQuestion(requestId, answers, directory))
      setPendingQuestionRequests(prev => prev.filter(r => r.id !== requestId))
      console.log(`[Question] Replied to ${requestId}`)
      return true
    } catch (error) {
      console.error('[Question] Failed to reply after retries:', error)
      setPendingQuestionRequests(prev => prev.filter(r => r.id !== requestId))
      return false
    } finally {
      replyingIdsRef.current.delete(requestId)
      setIsReplying(false)
    }
  }, [])

  const handleQuestionReject = useCallback(async (
    requestId: string,
    directory?: string
  ): Promise<boolean> => {
    if (replyingIdsRef.current.has(requestId)) {
      return false
    }
    
    replyingIdsRef.current.add(requestId)
    setIsReplying(true)
    
    try {
      await withRetry(() => rejectQuestion(requestId, directory))
      setPendingQuestionRequests(prev => prev.filter(r => r.id !== requestId))
      console.log(`[Question] Rejected ${requestId}`)
      return true
    } catch (error) {
      console.error('[Question] Failed to reject after retries:', error)
      setPendingQuestionRequests(prev => prev.filter(r => r.id !== requestId))
      return false
    } finally {
      replyingIdsRef.current.delete(requestId)
      setIsReplying(false)
    }
  }, [])

  // 主动轮询获取 pending 请求（用于 SSE 可能丢失事件的情况）
  const refreshPendingRequests = useCallback(async (sessionId?: string, directory?: string) => {
    try {
      const [permissions, questions] = await Promise.all([
        getPendingPermissions(sessionId, directory),
        getPendingQuestions(sessionId, directory),
      ])
      
      // 合并而不是替换，避免丢失刚收到的 SSE 事件
      setPendingPermissionRequests(prev => {
        const existingIds = new Set(prev.map(r => r.id))
        const newRequests = permissions.filter(r => !existingIds.has(r.id))
        if (newRequests.length > 0) {
          console.log(`[Permission] Found ${newRequests.length} new pending requests`)
          return [...prev, ...newRequests]
        }
        return prev
      })
      
      setPendingQuestionRequests(prev => {
        const existingIds = new Set(prev.map(r => r.id))
        const newRequests = questions.filter(r => !existingIds.has(r.id))
        if (newRequests.length > 0) {
          console.log(`[Question] Found ${newRequests.length} new pending requests`)
          return [...prev, ...newRequests]
        }
        return prev
      })
    } catch (error) {
      console.error('[Permission] Failed to refresh pending requests:', error)
    }
  }, [])

  const resetPendingRequests = useCallback(() => {
    setPendingPermissionRequests([])
    setPendingQuestionRequests([])
    replyingIdsRef.current.clear()
  }, [])

  return {
    pendingPermissionRequests,
    pendingQuestionRequests,
    setPendingPermissionRequests,
    setPendingQuestionRequests,
    handlePermissionReply,
    handleQuestionReply,
    handleQuestionReject,
    refreshPendingRequests,
    resetPendingRequests,
    isReplying,
  }
}
