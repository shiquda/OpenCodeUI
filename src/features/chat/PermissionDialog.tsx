import type { ApiPermissionRequest, PermissionReply } from '../../api'
import { DiffView } from '../../components/DiffView'
import { childSessionStore } from '../../store'

interface PermissionDialogProps {
  request: ApiPermissionRequest
  onReply: (reply: PermissionReply) => void
  queueLength?: number  // 队列中的请求数量
  isReplying?: boolean  // 是否正在回复
  currentSessionId?: string | null  // 当前主 session ID，用于判断是否来自子 agent
}

export function PermissionDialog({ request, onReply, queueLength = 1, isReplying = false, currentSessionId }: PermissionDialogProps) {
  // 从 metadata 中提取 diff 信息
  const metadata = request.metadata
  const diff = metadata?.diff as string | undefined
  const filepath = metadata?.filepath as string | undefined
  
  // Extract structured filediff if available
  let before: string | undefined
  let after: string | undefined
  
  if (metadata?.filediff && typeof metadata.filediff === 'object') {
    const fd = metadata.filediff as Record<string, unknown>
    before = String(fd.before || '')
    after = String(fd.after || '')
  }
  
  // 判断是否是文件编辑类权限
  const isFileEdit = request.permission === 'edit' || request.permission === 'write'

  // 判断是否来自子 session
  const isFromChildSession = currentSessionId && request.sessionID !== currentSessionId
  const childSessionInfo = isFromChildSession 
    ? childSessionStore.getSessionInfo(request.sessionID) 
    : null

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[10]">
      <div className="mx-auto max-w-3xl px-4 pb-7">
        <div className="border border-border-300/40 rounded-[14px] shadow-float bg-bg-100 overflow-hidden">
          <div className="bg-bg-000 rounded-t-[14px]">
            {/* Header */}
            <div className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center text-text-100 w-5 h-5">
                  <PlanIcon />
                </div>
                <h3 className="text-sm font-medium text-text-100">Permission: {request.permission}</h3>
                {queueLength > 1 && (
                  <span className="text-xs text-text-400 bg-bg-200 px-1.5 py-0.5 rounded">
                    +{queueLength - 1} more
                  </span>
                )}
              </div>
            </div>

            {/* Child session indicator */}
            {isFromChildSession && (
              <div className="px-4 pb-2 flex items-center gap-2">
                <SubagentIcon className="w-3.5 h-3.5 text-info-100" />
                <span className="text-xs text-info-100">
                  From subtask: {childSessionInfo?.title || 'Subtask'}
                </span>
              </div>
            )}

            <div className="border-t border-border-300/30" />

            {/* Content */}
            <div className="px-4 py-3 space-y-4 max-h-[45vh] overflow-y-auto custom-scrollbar">
              {/* Diff Preview for file edits */}
              {isFileEdit && diff && (
                <div>
                  <p className="text-xs text-text-400 mb-2">Changes preview</p>
                  <DiffView 
                    diff={diff} 
                    before={before}
                    after={after}
                    filePath={filepath}
                    defaultCollapsed={false}
                    maxHeight={200}
                  />
                </div>
              )}

              {/* Patterns */}
              {request.patterns && request.patterns.length > 0 && (
                <div>
                  <p className="text-xs text-text-400 mb-2">Patterns to allow</p>
                  <div className="space-y-1.5">
                    {request.patterns.map((pattern, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-text-400">
                          <GlobeIcon />
                        </span>
                        <span className="text-sm text-text-100 font-mono">{pattern}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Already allowed */}
              {request.always && request.always.length > 0 && (
                <div>
                  <p className="text-xs text-text-400 mb-2">Already allowed</p>
                  <div className="space-y-1.5">
                    {request.always.map((pattern, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full border border-border-300/50 flex items-center justify-center text-[10px] text-text-400 mt-0.5">
                          ✓
                        </span>
                        <span className="text-sm text-text-300 font-mono">{pattern}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-3 py-3 space-y-[6px]">
              {/* Primary: Allow once */}
              <button
                onClick={() => onReply('once')}
                disabled={isReplying}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-text-100 text-bg-000 hover:bg-text-200 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isReplying ? 'Sending...' : 'Allow once'}</span>
                {!isReplying && <ReturnIcon />}
              </button>
              
              {/* Secondary: Always allow */}
              <button
                onClick={() => onReply('always')}
                disabled={isReplying}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg border border-border-200/50 text-text-100 hover:bg-bg-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Always allow</span>
                <span className="text-xs text-text-400">This session</span>
              </button>

              {/* Tertiary: Reject */}
              <button
                onClick={() => onReply('reject')}
                disabled={isReplying}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-text-300 hover:bg-bg-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Reject</span>
                <span className="text-xs text-text-500">Esc</span>
              </button>

              <p className="text-[11px] text-text-500 pt-1 px-1 leading-relaxed">
                You can change permission settings at any time.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M5.99999 13.5C6.55227 13.5 6.99998 13.9478 6.99999 14.5V16.5C6.99999 17.0523 6.55228 17.5 5.99999 17.5H3.99999C3.44771 17.5 2.99999 17.0523 2.99999 16.5V14.5C3 13.9478 3.44772 13.5 3.99999 13.5H5.99999ZM3.99999 16.5H5.99999V14.5H3.99999V16.5ZM16.5 15C16.7761 15 17 15.2239 17 15.5C17 15.7762 16.7761 16 16.5 16H9.49999C9.22386 16 8.99999 15.7762 8.99999 15.5C9.00001 15.2239 9.22387 15 9.49999 15H16.5ZM5.99999 8.00002C6.55227 8.00002 6.99998 8.44775 6.99999 9.00002V11C6.99999 11.5523 6.55228 12 5.99999 12H3.99999C3.44771 12 2.99999 11.5523 2.99999 11V9.00002C3 8.44775 3.44772 8.00003 3.99999 8.00002H5.99999ZM3.99999 11H5.99999V9.00002H3.99999V11ZM16.5 9.50002C16.7761 9.50002 17 9.72389 17 10C17 10.2762 16.7761 10.5 16.5 10.5H9.49999C9.22386 10.5 8.99999 10.2762 8.99999 10C9.00001 9.7239 9.22387 9.50003 9.49999 9.50002H16.5ZM6.12597 2.91798C6.30923 2.71156 6.62549 2.69282 6.83202 2.87599C7.03846 3.05925 7.05721 3.37551 6.87402 3.58205L4.65624 6.08205C4.56198 6.18816 4.42708 6.24925 4.28515 6.25002C4.14315 6.25078 4.0075 6.19113 3.9121 6.08596L2.87987 4.94728L2.81932 4.86525C2.701 4.66516 2.7351 4.40248 2.91405 4.24025C3.09293 4.07823 3.35742 4.06993 3.54491 4.20705L3.62011 4.27541L4.27733 5.00002L6.12597 2.91798ZM16.5 4.00002C16.7761 4.00002 17 4.22389 17 4.50002C17 4.77616 16.7761 5.00002 16.5 5.00002H9.49999C9.22386 5.00001 8.99999 4.77615 8.99999 4.50002C9.00001 4.22389 9.22387 4.00002 9.49999 4.00002H16.5Z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7.2705 3.0498C11.1054 1.5437 15.4369 3.42942 16.9473 7.26367C18.4585 11.1003 16.5729 15.4359 12.7363 16.9473C8.89982 18.4583 4.56416 16.5736 3.05272 12.7373C1.54288 8.90435 3.42282 4.57201 7.25194 3.05663C7.25547 3.05522 7.25914 3.05413 7.26269 3.05273C7.26523 3.05172 7.26795 3.05079 7.2705 3.0498ZM8.64159 14.5283C8.05764 14.958 7.56418 15.4198 7.17772 15.8896C8.21355 16.3858 9.37633 16.6096 10.5508 16.5098C10.2224 16.2862 9.89754 16.0029 9.58202 15.6748C9.26312 15.3432 8.94744 14.9583 8.64159 14.5283ZM13.1572 12.5351C12.5305 12.6659 11.8818 12.8585 11.2275 13.1162C10.5729 13.3741 9.96666 13.6758 9.41894 14.0078C9.6946 14.3937 9.97385 14.7371 10.2539 15.0283C10.7036 15.4959 11.1332 15.8156 11.5117 15.9863C11.8879 16.1559 12.1765 16.1643 12.3935 16.0791C12.6107 15.9936 12.8179 15.7903 12.9775 15.4092C13.1379 15.0262 13.2342 14.4991 13.2441 13.8506C13.2503 13.4466 13.2187 13.0053 13.1572 12.5351ZM3.63768 8.51855C3.34594 9.76629 3.4167 11.1121 3.92186 12.3945C4.42675 13.6762 5.29203 14.7083 6.35546 15.4219C6.82009 14.8304 7.4201 14.2628 8.12694 13.748C7.6691 12.9972 7.2458 12.1466 6.88378 11.2275C6.52163 10.3082 6.25055 9.397 6.07323 8.53515C5.20566 8.64053 4.38055 8.63422 3.63768 8.51855ZM16.081 12.3828C15.4777 12.3027 14.8015 12.3016 14.081 12.3857C14.1506 12.9087 14.1838 13.4053 14.1767 13.8652C14.1698 14.3208 14.124 14.75 14.0361 15.1377C14.9636 14.4096 15.6617 13.4524 16.081 12.3828ZM10 4C7.79086 4 6 5.79086 6 8C6 10.2091 7.79086 12 10 12C12.2091 12 14 10.2091 14 8C14 5.79086 12.2091 4 10 4Z" />
    </svg>
  )
}

function ReturnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-text-500">
      <path d="M14.4999 7C14.4987 8.06051 14.0769 9.07725 13.3271 9.82715C12.5772 10.577 11.5604 10.9988 10.4999 11H3.20678L5.35366 13.1462C5.44748 13.2401 5.50018 13.3673 5.50018 13.5C5.50018 13.6327 5.44748 13.7599 5.35366 13.8538C5.25984 13.9476 5.13259 14.0003 4.99991 14.0003C4.86722 14.0003 4.73998 13.9476 4.64615 13.8538L1.64615 10.8538C1.59967 10.8073 1.56279 10.7522 1.53763 10.6915C1.51246 10.6308 1.49951 10.5657 1.49951 10.5C1.49951 10.4343 1.51246 10.3692 1.53763 10.3085C1.56279 10.2478 1.59967 10.1927 1.64615 10.1462L4.64615 7.14625C4.73998 7.05243 4.86722 6.99972 4.99991 6.99972C5.13259 6.99972 5.25984 7.05243 5.35366 7.14625C5.44748 7.24007 5.50018 7.36732 5.50018 7.5C5.50018 7.63268 5.44748 7.75993 5.35366 7.85375L3.20678 10H10.4999C11.2956 10 12.0586 9.68393 12.6212 9.12132C13.1838 8.55871 13.4999 7.79565 13.4999 7C13.4999 6.20435 13.1838 5.44129 12.6212 4.87868C12.0586 4.31607 11.2956 4 10.4999 4H4.99991C4.8673 4 4.74012 3.94732 4.64635 3.85355C4.55258 3.75979 4.49991 3.63261 4.49991 3.5C4.49991 3.36739 4.55258 3.24021 4.64635 3.14645C4.74012 3.05268 4.8673 3 4.99991 3H10.4999C11.5604 3.00116 12.5772 3.42296 13.3271 4.17285C14.0769 4.92275 14.4987 5.93949 14.4999 7Z" />
    </svg>
  )
}

function SubagentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
