import { useState, useCallback, useRef, useEffect, useReducer, useTransition } from 'react'
import { Header, InputBox, PermissionDialog, QuestionDialog, Sidebar, ChatArea, type ChatAreaHandle } from './features/chat'
import { useSessionEvents } from './features/message/useMessageEvents'
import { usePermissions, useTheme, useModels, useRouter, useRevertState, usePermissionHandler, useMessageAnimation, useDirectory, useSessionContext } from './hooks'
import type { Message, Part } from './types/message'
import { 
  getSessionMessages, sendMessage, abortSession, 
  getSelectableAgents, getSession, 
  extractUserMessageContent, 
  getPendingPermissions, getPendingQuestions, 
  type ApiSession,
  type ApiAgent, type Attachment, 
  type ApiMessageWithParts,
} from './api'
import { restoreModelSelection, createErrorHandler } from './utils'

const handleError = createErrorHandler('session')

// ============================================
// Messages Reducer - 确保 messages 和 prependedCount 原子更新
// ============================================

interface MessagesState {
  messages: Message[]
  prependedCount: number
}

type MessagesAction = 
  | { type: 'SET'; payload: Message[] }
  | { type: 'SET_WITH_MERGE'; payload: { apiMessages: ApiMessageWithParts[], convertFn: (m: ApiMessageWithParts) => Message } }
  | { type: 'PREPEND'; payload: Message[] }
  | { type: 'UPDATE'; updater: (prev: Message[]) => Message[] }
  | { type: 'RESET' }

// 创建一个适配器，让接收 setMessages 的 hook 可以使用 dispatch
export function createSetMessagesAdapter(
  dispatch: React.Dispatch<MessagesAction>
): React.Dispatch<React.SetStateAction<Message[]>> {
  return (action) => {
    if (typeof action === 'function') {
      dispatch({ type: 'UPDATE', updater: action })
    } else {
      dispatch({ type: 'SET', payload: action })
    }
  }
}

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case 'SET':
      // 设置新消息，重置 prependedCount
      return { messages: action.payload, prependedCount: 0 }
    case 'SET_WITH_MERGE': {
      // 使用合并策略设置消息，重置 prependedCount
      const { apiMessages, convertFn } = action.payload
      const merged = mergeMessages(state.messages, apiMessages, convertFn)
      return { messages: merged, prependedCount: 0 }
    }
    case 'PREPEND':
      // 向前添加消息，同时增加 prependedCount
      return {
        messages: [...action.payload, ...state.messages],
        prependedCount: state.prependedCount + action.payload.length
      }
    case 'UPDATE':
      // 更新消息（SSE 更新等），不改变 prependedCount
      return { ...state, messages: action.updater(state.messages) }
    case 'RESET':
      return { messages: [], prependedCount: 0 }
    default:
      return state
  }
}

// ============================================
// 消息合并工具函数
// ============================================

/**
 * 合并两个 parts 数组
 * - 以 API 返回的顺序为基准
 * - 如果本地有相同 id 的 part（可能被 SSE 更新过），使用本地版本
 * - 添加本地有但 API 没有的 parts（SSE 刚推送的新 parts）
 */
function mergeParts(localParts: Part[], apiParts: Part[]): Part[] {
  const localMap = new Map(localParts.map(p => [p.id, p]))
  
  // 以 API 的顺序为基准，但优先使用本地版本（可能更新）
  const result = apiParts.map(apiPart => {
    const localPart = localMap.get(apiPart.id)
    // 优先使用本地的（因为可能被 SSE 更新过）
    return localPart || apiPart
  }) as Part[]
  
  // 添加本地有但 API 没有的 parts（SSE 刚推送的新 parts）
  const apiIds = new Set(apiParts.map(p => p.id))
  for (const p of localParts) {
    if (!apiIds.has(p.id)) {
      result.push(p)
    }
  }
  
  return result
}

/**
 * 合并消息列表
 * - 以 API 返回的顺序为基准
 * - 对于已存在的消息，合并 parts
 * - 保留 SSE 添加的新消息
 */
function mergeMessages(
  localMessages: Message[], 
  apiMessages: ApiMessageWithParts[],
  convertFn: (m: ApiMessageWithParts) => Message
): Message[] {
  const localMap = new Map(localMessages.map(m => [m.info.id, m]))
  const apiIds = new Set(apiMessages.map(m => m.info.id))
  
  // 以 API 的顺序为基准
  const result = apiMessages.map(apiMsg => {
    const localMsg = localMap.get(apiMsg.info.id)
    
    if (localMsg) {
      // 消息已存在，合并 parts
      return {
        info: apiMsg.info as any, // 使用 API 的 info（可能有更新的元数据）
        parts: mergeParts(localMsg.parts, apiMsg.parts as Part[]),
        isStreaming: localMsg.isStreaming, // 保留本地的 streaming 状态
      }
    }
    
    // 新消息
    return convertFn(apiMsg)
  })
  
  // 添加本地有但 API 没有的消息（SSE 刚推送的新消息）
  for (const m of localMessages) {
    if (!apiIds.has(m.info.id)) {
      result.push(m)
    }
  }
  
  return result
}

function App() {
  // ============================================
  // State: Core
  // ============================================
  const [messagesState, dispatch] = useReducer(messagesReducer, { messages: [], prependedCount: 0 })
  const { messages, prependedCount } = messagesState
  // 创建 setMessages 适配器，让现有的 hooks 可以继续工作
  const setMessages = createSetMessagesAdapter(dispatch)
  const [isIdle, setIsIdle] = useState(true)
  const [, startTransition] = useTransition()
  
  // ============================================
  // State: UI
  // ============================================
  const [_isLoadingSession, setIsLoadingSession] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(() => {
    return localStorage.getItem('selected-model-id')
  })
  
  // ============================================
  // State: Session & Directory
  // ============================================
  const [sessionDirectory, setSessionDirectory] = useState<string>('')
  
  // ============================================
  // State: Agent & Model Selection
  // ============================================
  const [agents, setAgents] = useState<ApiAgent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('build')
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(undefined)

  // ============================================
  // Refs
  // ============================================
  const chatAreaRef = useRef<ChatAreaHandle>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const fullHistoryRef = useRef<ApiMessageWithParts[] | null>(null)

  // ============================================
  // Hooks
  // ============================================
  const { resetPermissions } = usePermissions()
  const { mode: themeMode, setTheme } = useTheme()
  const { models, isLoading: modelsLoading } = useModels()
  const { sessionId: routeSessionId, navigateToSession, navigateHome } = useRouter()
  const { currentDirectory, sidebarExpanded, setSidebarExpanded } = useDirectory()
  const { createSession } = useSessionContext()

  // Permission & Question handling
  const {
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
  } = usePermissionHandler()
  
  // 定期轮询 pending 请求（防止 SSE 丢失事件）
  useEffect(() => {
    if (!routeSessionId || isIdle) return
    
    // 首次进入 streaming 状态时立即检查
    refreshPendingRequests(routeSessionId, currentDirectory)
    
    // 每 5 秒轮询一次
    const interval = setInterval(() => {
      refreshPendingRequests(routeSessionId, currentDirectory)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [routeSessionId, isIdle, currentDirectory, refreshPendingRequests])

  // Message animations
  const { registerMessage, registerInputBox, animateUndo, animateRedo } = useMessageAnimation()

  // Undo/Redo (Revert) state
  const {
    revertedMessage,
    canUndo,
    canRedo,
    revertSteps,
    handleUndo: baseHandleUndo,
    handleRedo: baseHandleRedo,
    handleRedoAll: baseHandleRedoAll,
    clearRevert,
    setRevertedMessage,
    setRevertHistory,
    setSessionRevertState,
  } = useRevertState({
    routeSessionId,
    messages,
    setMessages,
    agentPhase: isIdle ? 'idle' : 'streaming',
    animateUndo,
    animateRedo,
    scrollToEnd: () => chatAreaRef.current?.scrollToLastMessage(),
  })

  // 包装 undo/redo 函数，在操作前禁用自动滚动
  const handleUndo = useCallback(async (userMessageId: string) => {
    chatAreaRef.current?.suppressAutoScroll(1000)
    await baseHandleUndo(userMessageId)
  }, [baseHandleUndo])

  const handleRedo = useCallback(async () => {
    chatAreaRef.current?.suppressAutoScroll(1000)
    await baseHandleRedo()
  }, [baseHandleRedo])

  const handleRedoAll = useCallback(async () => {
    chatAreaRef.current?.suppressAutoScroll(1000)
    await baseHandleRedoAll()
  }, [baseHandleRedoAll])

  // ============================================
  // Effects: Session ID Sync
  // ============================================
  useEffect(() => {
    currentSessionIdRef.current = routeSessionId
  }, [routeSessionId])

  // ============================================
  // Effects: Model Auto-Selection
  // ============================================
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId)
    localStorage.setItem('selected-model-id', modelId)
    setSelectedVariant(undefined)
  }, [])

  useEffect(() => {
    if (models.length === 0) return
    if (selectedModelId) {
      const exists = models.some(m => m.id === selectedModelId)
      if (!exists) handleModelChange(models[0].id)
    } else {
      handleModelChange(models[0].id)
    }
  }, [models, selectedModelId, handleModelChange])

  // ============================================
  // Effects: Fetch Agents
  // ============================================
  useEffect(() => {
    getSelectableAgents(currentDirectory)
      .then(setAgents)
      .catch(err => handleError('fetch agents', err))
  }, [currentDirectory])

  // ============================================
  // SSE Event Subscription (新版)
  // ============================================
  useSessionEvents(currentSessionIdRef, {
    setMessages,
    setIsIdle,
    setPendingPermissionRequests,
    setPendingQuestionRequests,
    scrollToBottomIfAtBottom: () => chatAreaRef.current?.scrollToBottomIfAtBottom(),
  })

  // ============================================
  // Handlers: Message Actions
  // ============================================
  const handleSend = useCallback(async (
    content: string, 
    attachments: Attachment[],
    options?: { agent?: string; variant?: string }
  ) => {
    const currentModel = models.find(m => m.id === selectedModelId)
    if (!currentModel) {
      console.error('No model selected')
      return
    }

    // 清除 revert 状态
    setRevertedMessage(undefined)
    setSessionRevertState(null)
    setRevertHistory([])

    // 设置为非 idle
    setIsIdle(false)

    try {
      // 如果没有当前 session，先创建一个
      let sessionId = routeSessionId
      if (!sessionId) {
        const newSession = await createSession() // 不需要传 directory，context 会自动处理
        sessionId = newSession.id
        currentSessionIdRef.current = sessionId
        navigateToSession(sessionId)
      }

      // 发送消息（响应会通过 SSE 事件流实时更新 UI）
      await sendMessage({
        sessionId,
        text: content,
        attachments,
        model: {
          providerID: currentModel.providerId,
          modelID: currentModel.id,
        },
        agent: options?.agent,
        variant: options?.variant,
        directory: currentDirectory,
      })

    } catch (error) {
      handleError('send message', error)
      setIsIdle(true)
    }
  }, [models, selectedModelId, routeSessionId, currentDirectory, navigateToSession])

  const handleNewChat = useCallback(() => {
    setMessages([])
    resetPermissions()
    resetPendingRequests()
    setSessionRevertState(null)
    setIsIdle(true)
  }, [resetPermissions, resetPendingRequests])

  const handleAbort = useCallback(async () => {
    if (!routeSessionId) return
    try {
      await abortSession(routeSessionId)
      setMessages(prev => prev.map(m => ({ ...m, isStreaming: false })))
      setIsIdle(true)
    } catch (error) {
      handleError('abort session', error)
    }
  }, [routeSessionId])

  // ============================================
  // Session Loading (简化版 - 直接使用 API 数据)
  // ============================================
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const INITIAL_MESSAGE_LIMIT = 20

  const loadSession = useCallback(async (sessionId: string, loadAll = false) => {
    setIsLoadingSession(true)
    fullHistoryRef.current = null
    try {
      const limit = loadAll ? undefined : INITIAL_MESSAGE_LIMIT
      const apiMessages = await getSessionMessages(sessionId, limit)
      
      // 获取 session 信息
      let revertState: ApiSession['revert'] | null = null
      try {
        const sessionInfo = await getSession(sessionId)
        revertState = sessionInfo.revert || null
        setSessionRevertState(revertState)
        setSessionDirectory(sessionInfo.directory || '')
      } catch (err) {
        handleError('get session info', err, true)
        setSessionRevertState(null)
        setSessionDirectory('')
      }
      
      // 获取 pending 权限请求
      try {
        const pendingPerms = await getPendingPermissions(sessionId)
        setPendingPermissionRequests(pendingPerms)
      } catch (err) {
        handleError('get pending permissions', err, true)
        setPendingPermissionRequests([])
      }
      
      // 获取 pending 问题请求
      try {
        const pendingQs = await getPendingQuestions(sessionId)
        setPendingQuestionRequests(pendingQs)
      } catch (err) {
        handleError('get pending questions', err, true)
        setPendingQuestionRequests([])
      }
      
      // 转换 API 消息为新的 Message 格式
      const convertApiToMessage = (apiMsg: ApiMessageWithParts): Message => ({
        info: apiMsg.info as any,
        parts: apiMsg.parts as Part[],
        isStreaming: false,
      })
      
      // 处理 revert 状态
      if (revertState?.messageID) {
        const revertedApiMessage = apiMessages.find(m => m.info.id === revertState!.messageID)
        
        if (revertedApiMessage) {
          const revertedIndex = apiMessages.findIndex(m => m.info.id === revertState!.messageID)
          
          // 收集被撤销的 user 消息
          const revertedUserMessages = apiMessages
            .slice(revertedIndex)
            .filter(m => m.info.role === 'user')
          
          const fullRevertHistory = revertedUserMessages.map(m => ({
            messageId: m.info.id,
            content: extractUserMessageContent(m)
          }))
          
          setRevertedMessage(fullRevertHistory[0]?.content)
          setRevertHistory(fullRevertHistory)
          
          // 过滤掉被撤销的消息，使用合并策略
          const filteredApiMessages = apiMessages.slice(0, revertedIndex)
          setMessages(prev => mergeMessages(prev, filteredApiMessages, convertApiToMessage))
          
          // 恢复模型选择
          const lastUserMsg = [...filteredApiMessages].reverse().find(m => m.info.role === 'user')
          if (lastUserMsg && 'model' in lastUserMsg.info) {
            const userInfo = lastUserMsg.info as any
            const modelSelection = restoreModelSelection(
              userInfo.model,
              userInfo.variant,
              models
            )
            if (modelSelection) {
              setSelectedModelId(modelSelection.modelId)
              setSelectedVariant(modelSelection.variant)
            }
          }
        } else {
          // 找不到被撤销的消息，正常加载（使用合并策略）
          setMessages(prev => mergeMessages(prev, apiMessages, convertApiToMessage))
          setRevertedMessage(undefined)
          setRevertHistory([])
        }
      } else {
        // 没有 revert 状态，正常加载（使用合并策略）
        setMessages(prev => mergeMessages(prev, apiMessages, convertApiToMessage))
        setRevertedMessage(undefined)
        setRevertHistory([])
        
        // 恢复模型选择
        const lastUserMsg = [...apiMessages].reverse().find(m => m.info.role === 'user')
        if (lastUserMsg && 'model' in lastUserMsg.info) {
          const userInfo = lastUserMsg.info as any
          const modelSelection = restoreModelSelection(
            userInfo.model,
            userInfo.variant,
            models
          )
          if (modelSelection) {
            setSelectedModelId(modelSelection.modelId)
            setSelectedVariant(modelSelection.variant)
          }
        }
      }
      
      // 检查是否有更多历史
      setHasMoreHistory(!loadAll && apiMessages.length >= INITIAL_MESSAGE_LIMIT)
      
      // 检查最后一条消息是否正在 streaming
      const lastMsg = apiMessages[apiMessages.length - 1]
      if (lastMsg?.info.role === 'assistant') {
        const assistantInfo = lastMsg.info as any
        const isStillStreaming = !assistantInfo.time?.completed
        setIsIdle(!isStillStreaming)
      } else {
        setIsIdle(true)
      }
      
      // 滚动到底部
      setTimeout(() => {
        chatAreaRef.current?.scrollToBottom(true)
      }, 20)
    } catch (e) {
      handleError('load session messages', e)
      setMessages([])
      setSessionRevertState(null)
      setRevertedMessage(undefined)
    } finally {
      setIsLoadingSession(false)
    }
  }, [models])

  // 加载更多历史消息
  const loadMoreHistory = useCallback(async () => {
    if (!routeSessionId || isLoadingMore || !hasMoreHistory) return
    
    setIsLoadingMore(true)
    try {
      let allMessages = fullHistoryRef.current
      
      if (!allMessages) {
        allMessages = await getSessionMessages(routeSessionId)
        fullHistoryRef.current = allMessages
      }
      
      const oldestMessageId = messages[0]?.info.id
      let oldestIndex = -1
      if (oldestMessageId) {
        oldestIndex = allMessages.findIndex(m => m.info.id === oldestMessageId)
      }
      
      let newOldMessages: ApiMessageWithParts[] = []
      
      if (oldestIndex === -1) {
        newOldMessages = allMessages
        setHasMoreHistory(false)
      } else {
        const startIndex = Math.max(0, oldestIndex - 15)
        newOldMessages = allMessages.slice(startIndex, oldestIndex)
        setHasMoreHistory(startIndex > 0)
      }
      
      if (newOldMessages.length > 0) {
        const convertedMessages = newOldMessages.map(m => ({
          info: m.info as any,
          parts: m.parts as Part[],
          isStreaming: false,
        }))
        
        if (oldestIndex === -1) {
          // 完全重置，用 SET action（自动重置 prependedCount）
          dispatch({ type: 'SET', payload: convertedMessages })
        } else {
          // 使用 PREPEND action，原子更新 messages 和 prependedCount
          // 使用 startTransition 避免阻塞 UI 线程（减少卡顿）
          startTransition(() => {
            dispatch({ type: 'PREPEND', payload: convertedMessages })
          })
        }
      } else {
        setHasMoreHistory(false)
      }
    } catch (e) {
      handleError('load more messages', e)
    } finally {
      setIsLoadingMore(false)
    }
  }, [routeSessionId, isLoadingMore, hasMoreHistory, messages])

  // 监听路由变化
  useEffect(() => {
    if (routeSessionId) {
      loadSession(routeSessionId)
      // loadSession 内部使用 SET_WITH_MERGE，会自动重置 prependedCount
    } else {
      // 使用 RESET action，同时重置 messages 和 prependedCount
      dispatch({ type: 'RESET' })
    }
  }, [routeSessionId, loadSession])

  const handleSelectSession = useCallback((session: ApiSession) => {
    navigateToSession(session.id)
  }, [navigateToSession])

  const handleNewSession = useCallback(() => {
    navigateHome()
    handleNewChat()
  }, [navigateHome, handleNewChat])

  return (
    <div className="relative h-screen flex">
      {/* Sidebar - 现在是 flex item，不是 absolute */}
      <Sidebar
        isOpen={sidebarExpanded}
        selectedSessionId={routeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onClose={() => setSidebarExpanded(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen bg-bg-100 relative overflow-hidden">
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
            <div className="pointer-events-auto">
              <Header
                models={models}
                modelsLoading={modelsLoading}
                selectedModelId={selectedModelId}
                onModelChange={handleModelChange}
                onNewChat={handleNewChat}
                onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)}
                themeMode={themeMode}
                onThemeChange={setTheme}
              />
            </div>
          </div>

          {/* Scrollable Area */}
          <div className="absolute inset-0">
            <ChatArea 
              ref={chatAreaRef} 
              messages={messages} 
              prependedCount={prependedCount}
              onLoadMore={loadMoreHistory}
              onUndo={handleUndo}
              canUndo={canUndo}
              registerMessage={registerMessage}
            />
          </div>

          {/* Floating Input Box */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
            <InputBox 
              onSend={handleSend} 
              onAbort={handleAbort}
              disabled={!isIdle}
              isStreaming={!isIdle}
              agents={agents}
              selectedAgent={selectedAgent}
              onAgentChange={setSelectedAgent}
              variants={models.find(m => m.id === selectedModelId)?.variants ?? []}
              selectedVariant={selectedVariant}
              onVariantChange={setSelectedVariant}
              supportsImages={models.find(m => m.id === selectedModelId)?.supportsImages ?? false}
              rootPath={sessionDirectory}
              revertedText={revertedMessage?.text}
              revertedAttachments={revertedMessage?.attachments}
              canRedo={canRedo}
              revertSteps={revertSteps}
              onRedo={handleRedo}
              onRedoAll={handleRedoAll}
              onClearRevert={clearRevert}
              registerInputBox={registerInputBox}
            />
          </div>
        </div>
        
        {/* Permission Dialog */}
        {pendingPermissionRequests.length > 0 && (
          <PermissionDialog
            request={pendingPermissionRequests[0]}
            onReply={(reply) => handlePermissionReply(pendingPermissionRequests[0].id, reply, currentDirectory)}
            queueLength={pendingPermissionRequests.length}
            isReplying={isReplying}
          />
        )}

        {/* Question Dialog */}
        {pendingPermissionRequests.length === 0 && pendingQuestionRequests.length > 0 && (
          <QuestionDialog
            request={pendingQuestionRequests[0]}
            onReply={(answers) => handleQuestionReply(pendingQuestionRequests[0].id, answers, currentDirectory)}
            onReject={() => handleQuestionReject(pendingQuestionRequests[0].id, currentDirectory)}
            queueLength={pendingQuestionRequests.length}
            isReplying={isReplying}
          />
        )}
      </div>
    </div>
  )
}

export default App
