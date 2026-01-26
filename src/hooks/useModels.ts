import { useState, useEffect, useCallback } from 'react'
import { getActiveModels, type ModelInfo } from '../api'

interface UseModelsResult {
  models: ModelInfo[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useModels(): UseModelsResult {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchModels = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getActiveModels()
      setModels(data)
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch models'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
  }
}
