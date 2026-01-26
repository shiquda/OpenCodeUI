import { useState, useCallback, useRef, useEffect } from 'react'
import type { ApiQuestionRequest, ApiQuestionInfo, QuestionAnswer } from '../../api'

interface QuestionDialogProps {
  request: ApiQuestionRequest
  onReply: (answers: QuestionAnswer[]) => void
  onReject: () => void
  queueLength?: number
  isReplying?: boolean
}

export function QuestionDialog({ request, onReply, onReject, queueLength = 1, isReplying = false }: QuestionDialogProps) {
  // 每个问题选中的选项 labels
  const [answers, setAnswers] = useState<Map<number, Set<string>>>(() => {
    const map = new Map<number, Set<string>>()
    request.questions.forEach((_, idx) => map.set(idx, new Set()))
    return map
  })
  
  // 每个问题是否启用了自定义输入
  const [customEnabled, setCustomEnabled] = useState<Map<number, boolean>>(() => {
    const map = new Map<number, boolean>()
    request.questions.forEach((_, idx) => map.set(idx, false))
    return map
  })
  
  // 每个问题的自定义输入值
  const [customValues, setCustomValues] = useState<Map<number, string>>(() => {
    const map = new Map<number, string>()
    request.questions.forEach((_, idx) => map.set(idx, ''))
    return map
  })

  // 单选：选择一个选项
  const selectOption = useCallback((qIdx: number, label: string) => {
    setAnswers(prev => {
      const newMap = new Map(prev)
      newMap.set(qIdx, new Set([label]))
      return newMap
    })
    // 取消自定义
    setCustomEnabled(prev => {
      const newMap = new Map(prev)
      newMap.set(qIdx, false)
      return newMap
    })
  }, [])

  // 单选：选择自定义
  const selectCustom = useCallback((qIdx: number) => {
    setAnswers(prev => {
      const newMap = new Map(prev)
      newMap.set(qIdx, new Set())
      return newMap
    })
    setCustomEnabled(prev => {
      const newMap = new Map(prev)
      newMap.set(qIdx, true)
      return newMap
    })
  }, [])

  // 多选：toggle 选项
  const toggleOption = useCallback((qIdx: number, label: string) => {
    setAnswers(prev => {
      const newMap = new Map(prev)
      const current = new Set(prev.get(qIdx) || [])
      if (current.has(label)) {
        current.delete(label)
      } else {
        current.add(label)
      }
      newMap.set(qIdx, current)
      return newMap
    })
  }, [])

  // 多选：toggle 自定义启用状态
  const toggleCustom = useCallback((qIdx: number) => {
    setCustomEnabled(prev => {
      const newMap = new Map(prev)
      newMap.set(qIdx, !prev.get(qIdx))
      return newMap
    })
  }, [])

  // 更新自定义输入值
  const updateCustomValue = useCallback((qIdx: number, value: string) => {
    setCustomValues(prev => {
      const newMap = new Map(prev)
      newMap.set(qIdx, value)
      return newMap
    })
  }, [])

  // 提交
  const handleSubmit = useCallback(() => {
    const result: QuestionAnswer[] = request.questions.map((q, idx) => {
      const selected = Array.from(answers.get(idx) || [])
      const isCustomEnabled = customEnabled.get(idx)
      const customValue = customValues.get(idx)?.trim()
      
      if (q.multiple) {
        // 多选：合并选中的选项 + 启用的自定义值
        if (isCustomEnabled && customValue && q.custom !== false) {
          return [...selected, customValue]
        }
        return selected
      } else {
        // 单选：要么是选中的选项，要么是自定义值
        if (isCustomEnabled && customValue) {
          return [customValue]
        }
        return selected
      }
    })
    onReply(result)
  }, [request.questions, answers, customEnabled, customValues, onReply])

  // 检查能否提交
  const canSubmit = request.questions.every((q, idx) => {
    const selected = answers.get(idx) || new Set()
    const isCustomEnabled = customEnabled.get(idx)
    const customValue = customValues.get(idx)?.trim()
    
    if (q.multiple) {
      // 多选：有选项或（启用自定义且有值）
      return selected.size > 0 || (isCustomEnabled && customValue)
    } else {
      // 单选：有选项，或（选了自定义且有值）
      return selected.size > 0 || (isCustomEnabled && customValue)
    }
  })

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[10]">
      <div className="mx-auto max-w-3xl px-4 pb-7">
        <div className="border border-border-300/40 rounded-[14px] shadow-float bg-bg-100 overflow-hidden">
          <div className="bg-bg-000 rounded-t-[14px]">
            {/* Header */}
            <div className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center text-text-100 w-5 h-5">
                  <QuestionIcon />
                </div>
                <h3 className="text-sm font-medium text-text-100">Question</h3>
                {queueLength > 1 && (
                  <span className="text-xs text-text-400 bg-bg-200 px-1.5 py-0.5 rounded">
                    +{queueLength - 1} more
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-border-300/30" />

            {/* Questions */}
            <div className="px-4 py-3 space-y-5 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {request.questions.map((question, qIdx) => (
                <QuestionItem
                  key={qIdx}
                  question={question}
                  selected={answers.get(qIdx) || new Set()}
                  isCustomEnabled={customEnabled.get(qIdx) || false}
                  customValue={customValues.get(qIdx) || ''}
                  onSelectOption={(label) => selectOption(qIdx, label)}
                  onSelectCustom={() => selectCustom(qIdx)}
                  onToggleOption={(label) => toggleOption(qIdx, label)}
                  onToggleCustom={() => toggleCustom(qIdx)}
                  onCustomValueChange={(value) => updateCustomValue(qIdx, value)}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="px-3 py-3 space-y-[6px]">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isReplying}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-text-100 text-bg-000 hover:bg-text-200 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isReplying ? 'Sending...' : 'Submit'}</span>
                {!isReplying && <ReturnIcon />}
              </button>

              <button
                onClick={onReject}
                disabled={isReplying}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-text-300 hover:bg-bg-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Skip</span>
                <span className="text-xs text-text-500">Esc</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 单个问题
interface QuestionItemProps {
  question: ApiQuestionInfo
  selected: Set<string>
  isCustomEnabled: boolean
  customValue: string
  onSelectOption: (label: string) => void
  onSelectCustom: () => void
  onToggleOption: (label: string) => void
  onToggleCustom: () => void
  onCustomValueChange: (value: string) => void
}

function QuestionItem({
  question,
  selected,
  isCustomEnabled,
  customValue,
  onSelectOption,
  onSelectCustom,
  onToggleOption,
  onToggleCustom,
  onCustomValueChange,
}: QuestionItemProps) {
  const isMultiple = question.multiple || false
  const allowCustom = question.custom !== false
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整 textarea 高度
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [])

  // 单选模式下，选中自定义时自动聚焦
  useEffect(() => {
    if (!isMultiple && isCustomEnabled && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isMultiple, isCustomEnabled])

  // 多选模式下，启用自定义时自动聚焦
  useEffect(() => {
    if (isMultiple && isCustomEnabled && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isMultiple, isCustomEnabled])

  return (
    <div className="space-y-2.5">
      {/* Question text */}
      <div>
        <p className="text-xs text-text-400 mb-0.5">{question.header}</p>
        <p className="text-sm text-text-100">{question.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-1.5">
        {question.options.map((option, idx) => {
          const isSelected = selected.has(option.label)
          
          return (
            <button
              key={idx}
              onClick={() => isMultiple ? onToggleOption(option.label) : onSelectOption(option.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                isSelected
                  ? 'border-text-100 bg-bg-200'
                  : 'border-border-200/50 hover:bg-bg-200'
              }`}
            >
              <Indicator type={isMultiple ? 'checkbox' : 'radio'} checked={isSelected} />
              
              <div className="flex-1 min-w-0">
                <span className="text-sm text-text-100">{option.label}</span>
                {option.description && (
                  <p className="text-xs text-text-400 mt-0.5">{option.description}</p>
                )}
              </div>
            </button>
          )
        })}

        {/* Custom option */}
        {allowCustom && (
          <div
            onClick={() => isMultiple ? onToggleCustom() : onSelectCustom()}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
              isCustomEnabled
                ? 'border-text-100 bg-bg-200'
                : 'border-border-200/50 hover:bg-bg-200'
            }`}
          >
            <div className="pt-0.5">
              <Indicator type={isMultiple ? 'checkbox' : 'radio'} checked={isCustomEnabled} />
            </div>
            
            <textarea
              ref={textareaRef}
              value={customValue}
              onChange={(e) => {
                onCustomValueChange(e.target.value)
                adjustTextareaHeight()
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!isCustomEnabled) {
                  if (isMultiple) onToggleCustom()
                  else onSelectCustom()
                }
              }}
              placeholder="Type your own answer..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-text-100 placeholder:text-text-500 focus:outline-none resize-none min-h-[20px]"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Radio / Checkbox indicator
function Indicator({ type, checked }: { type: 'radio' | 'checkbox'; checked: boolean }) {
  const baseClass = `flex-shrink-0 w-[18px] h-[18px] border-2 flex items-center justify-center transition-colors`
  const shapeClass = type === 'radio' ? 'rounded-full' : 'rounded'
  const stateClass = checked
    ? 'border-text-100 bg-text-100 text-bg-000'
    : 'border-border-300'

  return (
    <span className={`${baseClass} ${shapeClass} ${stateClass}`}>
      {checked && <CheckIcon />}
    </span>
  )
}

// Icons
function QuestionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM10 16.5C6.41015 16.5 3.5 13.5899 3.5 10C3.5 6.41015 6.41015 3.5 10 3.5C13.5899 3.5 16.5 6.41015 16.5 10C16.5 13.5899 13.5899 16.5 10 16.5ZM10.5 13.5C10.5 13.7761 10.2761 14 10 14C9.72386 14 9.5 13.7761 9.5 13.5C9.5 13.2239 9.72386 13 10 13C10.2761 13 10.5 13.2239 10.5 13.5ZM10 6C8.61929 6 7.5 7.11929 7.5 8.5C7.5 8.77614 7.72386 9 8 9C8.27614 9 8.5 8.77614 8.5 8.5C8.5 7.67157 9.17157 7 10 7C10.8284 7 11.5 7.67157 11.5 8.5C11.5 9.16531 11.0826 9.54668 10.5399 9.93733C10.2461 10.1489 9.94649 10.3526 9.71969 10.6139C9.48276 10.8871 9.33333 11.2204 9.33333 11.6667C9.33333 11.9428 9.55719 12.1667 9.83333 12.1667C10.1095 12.1667 10.3333 11.9428 10.3333 11.6667C10.3333 11.4463 10.4006 11.2962 10.5303 11.1472C10.6701 10.9864 10.8789 10.8344 11.1268 10.6456C11.7507 10.1867 12.5 9.50135 12.5 8.5C12.5 7.11929 11.3807 6 10 6Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M8 3L4 7L2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
