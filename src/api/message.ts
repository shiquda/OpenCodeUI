// ============================================
// Message API Functions
// ============================================

import {
  API_BASE,
  type ApiMessageWithParts,
  type ApiTextPart,
  type ApiFilePart,
  type ApiAgentPart,
  type Attachment,
  type RevertedMessage,
  type SendMessageParams,
  type SendMessageResponse,
} from './types'

/**
 * 构建带 directory 的 URL
 */
function buildUrl(path: string, directory?: string, extraParams?: URLSearchParams): string {
  const params = extraParams || new URLSearchParams()
  if (directory) params.set('directory', directory)
  const queryString = params.toString()
  return `${API_BASE}${path}${queryString ? '?' + queryString : ''}`
}

export async function getSessionMessages(
  sessionId: string, 
  limit?: number,
  directory?: string
): Promise<ApiMessageWithParts[]> {
  const params = new URLSearchParams()
  if (limit !== undefined) params.set('limit', String(limit))
  
  const url = buildUrl(`/session/${sessionId}/message`, directory, params)
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status}`)
  }

  return response.json()
}

export async function getSessionMessageCount(sessionId: string): Promise<number> {
  const messages = await getSessionMessages(sessionId)
  return messages.length
}

/**
 * 从 API 消息中提取用户消息内容（文本+附件）
 */
export function extractUserMessageContent(apiMessage: ApiMessageWithParts): RevertedMessage {
  const { parts } = apiMessage
  
  const textParts = parts.filter((p): p is ApiTextPart => p.type === 'text' && !p.synthetic)
  const text = textParts.map(p => p.text).join('\n')
  
  const attachments: Attachment[] = []
  
  for (const part of parts) {
    if (part.type === 'file') {
      const fp = part as ApiFilePart
      const isFolder = fp.mime === 'application/x-directory'
      attachments.push({
        id: fp.id || crypto.randomUUID(),
        type: isFolder ? 'folder' : 'file',
        displayName: fp.filename || fp.source?.path || 'file',
        url: fp.url,
        mime: fp.mime,
        relativePath: fp.source?.path,
        textRange: fp.source?.text ? {
          value: fp.source.text.value,
          start: fp.source.text.start,
          end: fp.source.text.end,
        } : undefined,
      })
    } else if (part.type === 'agent') {
      const ap = part as ApiAgentPart
      attachments.push({
        id: ap.id || crypto.randomUUID(),
        type: 'agent',
        displayName: ap.name,
        agentName: ap.name,
        textRange: ap.source ? {
          value: ap.source.value,
          start: ap.source.start,
          end: ap.source.end,
        } : undefined,
      })
    }
  }
  
  return { text, attachments }
}

/**
 * 构建 file:// URL
 */
function toFileUrl(path: string): string {
  if (!path) return ''
  
  if (path.startsWith('file://')) {
    return path
  }
  
  if (path.startsWith('data:')) {
    return path
  }
  
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) {
    return `file:///${normalized}`
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`
  }
  return `file:///${normalized}`
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
  const { sessionId, text, attachments, model, agent, variant, directory } = params

  const parts: Array<{ type: string; [key: string]: unknown }> = []
  
  parts.push({
    type: 'text',
    text,
  })
  
  for (const attachment of attachments) {
    if (attachment.type === 'agent') {
      parts.push({
        type: 'agent',
        name: attachment.agentName,
        source: attachment.textRange ? {
          value: attachment.textRange.value,
          start: attachment.textRange.start,
          end: attachment.textRange.end,
        } : undefined,
      })
    } else {
      const fileUrl = toFileUrl(attachment.url || '')
      if (!fileUrl) {
        console.warn('Skipping attachment with empty URL:', attachment)
        continue
      }
      
      parts.push({
        type: 'file',
        mime: attachment.mime || (attachment.type === 'folder' ? 'application/x-directory' : 'text/plain'),
        url: fileUrl,
        filename: attachment.displayName,
        source: attachment.textRange ? {
          text: {
            value: attachment.textRange.value,
            start: attachment.textRange.start,
            end: attachment.textRange.end,
          },
          type: 'file',
          path: attachment.relativePath || attachment.displayName,
        } : undefined,
      })
    }
  }

  const requestBody: Record<string, unknown> = {
    parts,
    model,
  }
  
  if (agent) {
    requestBody.agent = agent
  }
  
  if (variant) {
    requestBody.variant = variant
  }

  const url = buildUrl(`/session/${sessionId}/message`, directory)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    let errorMsg = `Failed to send message: ${response.status}`
    try {
      const errorText = await response.text()
      if (errorText) {
        errorMsg += ` - ${errorText}`
      }
    } catch {
      // 忽略读取错误
    }
    throw new Error(errorMsg)
  }

  const responseText = await response.text()
  if (!responseText) {
    throw new Error('Failed to send message: Empty response from server')
  }
  
  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error(`Failed to send message: Invalid JSON response - ${responseText.slice(0, 100)}`)
  }
}
