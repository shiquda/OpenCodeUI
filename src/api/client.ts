// ============================================
// API Client for OpenCode Backend
// ============================================

import {
  API_BASE,
  type ProvidersResponse,
  type ModelInfo,
  type ApiProject,
  type ApiPath,
} from './types'

// Re-export all types
export * from './types'

// Re-export from Attachment component
export { fromFilePart, fromAgentPart } from '../components/Attachment'

// Re-export from sub-modules
export * from './session'
export * from './message'
export * from './permission'
export * from './file'
export * from './agent'
export * from './events'

// ============================================
// Model API Functions
// ============================================

export async function getActiveModels(): Promise<ModelInfo[]> {
  const response = await fetch(`${API_BASE}/config/providers`)
  if (!response.ok) {
    throw new Error(`Failed to fetch providers: ${response.status}`)
  }

  const data: ProvidersResponse = await response.json()
  const models: ModelInfo[] = []

  for (const provider of data.providers) {
    for (const [, model] of Object.entries(provider.models)) {
      if (model.status === 'active') {
        const variants = model.variants ? Object.keys(model.variants) : []
        
        models.push({
          id: model.id,
          name: model.name,
          providerId: provider.id,
          providerName: provider.name,
          family: model.family,
          contextLimit: model.limit.context,
          outputLimit: model.limit.output,
          supportsReasoning: model.capabilities.reasoning,
          supportsImages: model.capabilities.input.image,
          supportsToolcall: model.capabilities.toolcall,
          variants,
        })
      }
    }
  }

  return models
}

export async function getDefaultModels(): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE}/config/providers`)
  if (!response.ok) {
    throw new Error(`Failed to fetch providers: ${response.status}`)
  }

  const data: ProvidersResponse = await response.json()
  return data.default
}

// ============================================
// Project API Functions
// ============================================

export async function getCurrentProject(): Promise<ApiProject> {
  const response = await fetch(`${API_BASE}/project/current`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch current project: ${response.status}`)
  }

  return response.json()
}

export async function getProjects(): Promise<ApiProject[]> {
  const response = await fetch(`${API_BASE}/project`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.status}`)
  }

  return response.json()
}

export async function updateProject(projectId: string, params: {
  name?: string
  icon?: { url?: string; override?: string; color?: string }
}): Promise<ApiProject> {
  const response = await fetch(`${API_BASE}/project/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to update project: ${response.status}`)
  }

  return response.json()
}

// ============================================
// Path API Functions
// ============================================

export async function getPath(): Promise<ApiPath> {
  const response = await fetch(`${API_BASE}/path`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch path: ${response.status}`)
  }

  return response.json()
}
