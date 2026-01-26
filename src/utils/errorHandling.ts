// ============================================
// 统一错误处理工具
// ============================================

type ErrorCategory = 
  | 'api'        // API 调用错误
  | 'session'    // Session 相关错误
  | 'permission' // 权限相关错误
  | 'ui'         // UI 交互错误
  | 'parse'      // 解析错误

interface ErrorContext {
  category: ErrorCategory
  operation: string
  silent?: boolean  // 静默错误，不显示给用户
}

/**
 * 统一的错误日志函数
 * 
 * 未来可以扩展为：
 * - 发送到错误监控服务
 * - 显示 toast 通知
 * - 根据错误类型做不同处理
 */
export function logError(
  error: unknown, 
  context: ErrorContext
): void {
  const { category, operation, silent = false } = context
  
  // 开发环境下始终输出到控制台
  if (import.meta.env.DEV) {
    console.error(`[${category}] ${operation}:`, error)
  }
  
  // 非静默错误，未来可以显示 toast
  if (!silent) {
    // TODO: 集成 toast 通知系统
    // showToast({ type: 'error', message: `${operation} failed` })
  }
}

/**
 * 包装异步函数，自动处理错误
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: ErrorContext
): Promise<T | undefined> {
  return fn().catch((error) => {
    logError(error, context)
    return undefined
  })
}

/**
 * 创建带上下文的错误处理器
 * 用于同一模块内多次使用
 */
export function createErrorHandler(category: ErrorCategory) {
  return (operation: string, error: unknown, silent = false) => {
    logError(error, { category, operation, silent })
  }
}
