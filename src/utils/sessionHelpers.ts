// ============================================
// Session 加载相关的辅助函数
// ============================================

import type { ModelInfo } from '../api'

// ============================================
// Model Selection 恢复
// ============================================

export interface ModelSelectionResult {
  modelId: string | null
  variant: string | undefined
}

/**
 * 根据 session 最后使用的模型信息恢复选择
 */
export function restoreModelSelection(
  lastModel: { providerID: string; modelID: string } | null,
  lastVariant: string | null,
  models: ModelInfo[]
): ModelSelectionResult | null {
  if (!lastModel || models.length === 0) {
    return null
  }
  
  const modelExists = models.some(m => m.id === lastModel.modelID)
  if (!modelExists) {
    return null
  }
  
  let variant: string | undefined = undefined
  if (lastVariant) {
    const model = models.find(m => m.id === lastModel.modelID)
    if (model && model.variants.includes(lastVariant)) {
      variant = lastVariant
    }
  }
  
  return {
    modelId: lastModel.modelID,
    variant
  }
}
