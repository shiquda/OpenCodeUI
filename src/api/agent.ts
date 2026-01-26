// ============================================
// Agent API Functions
// ============================================

import {
  API_BASE,
  type ApiAgent,
} from './types'

export async function getAgents(directory?: string): Promise<ApiAgent[]> {
  const params = new URLSearchParams()
  if (directory) params.set('directory', directory)
  
  const url = `${API_BASE}/agent${params.toString() ? '?' + params.toString() : ''}`
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status}`)
  }

  return response.json()
}

export async function getSelectableAgents(directory?: string): Promise<ApiAgent[]> {
  const agents = await getAgents(directory)
  return agents.filter(agent => !agent.hidden)
}
