// ============================================
// Permission & Question API Functions
// ============================================

import {
  API_BASE,
  type ApiPermissionRequest,
  type PermissionReply,
  type ApiQuestionRequest,
  type QuestionAnswer,
} from './types'

/**
 * 构建带 directory 的 URL
 */
function buildUrl(path: string, directory?: string): string {
  if (!directory) return `${API_BASE}${path}`
  const params = new URLSearchParams()
  params.set('directory', directory)
  return `${API_BASE}${path}?${params.toString()}`
}

// ============================================
// Permission API
// ============================================

export async function replyPermission(
  requestId: string,
  reply: PermissionReply,
  message?: string,
  directory?: string
): Promise<boolean> {
  const response = await fetch(buildUrl(`/permission/${requestId}/reply`, directory), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply, message }),
  })

  if (!response.ok) {
    throw new Error(`Failed to reply permission: ${response.status}`)
  }

  return response.json()
}

export async function getPendingPermissions(sessionId?: string, directory?: string): Promise<ApiPermissionRequest[]> {
  const response = await fetch(buildUrl('/permission', directory))
  
  if (!response.ok) {
    throw new Error(`Failed to get permissions: ${response.status}`)
  }
  
  const permissions: ApiPermissionRequest[] = await response.json()
  
  if (sessionId) {
    return permissions.filter(p => p.sessionID === sessionId)
  }
  
  return permissions
}

// ============================================
// Question API
// ============================================

export async function getPendingQuestions(sessionId?: string, directory?: string): Promise<ApiQuestionRequest[]> {
  const response = await fetch(buildUrl('/question', directory))
  
  if (!response.ok) {
    throw new Error(`Failed to get questions: ${response.status}`)
  }
  
  const questions: ApiQuestionRequest[] = await response.json()
  
  if (sessionId) {
    return questions.filter(q => q.sessionID === sessionId)
  }
  
  return questions
}

export async function replyQuestion(
  requestId: string,
  answers: QuestionAnswer[],
  directory?: string
): Promise<boolean> {
  const response = await fetch(buildUrl(`/question/${requestId}/reply`, directory), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  })

  if (!response.ok) {
    throw new Error(`Failed to reply question: ${response.status}`)
  }

  return response.json()
}

export async function rejectQuestion(requestId: string, directory?: string): Promise<boolean> {
  const response = await fetch(buildUrl(`/question/${requestId}/reject`, directory), {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Failed to reject question: ${response.status}`)
  }

  return response.json()
}
