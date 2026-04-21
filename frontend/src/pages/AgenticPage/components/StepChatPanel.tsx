import { Loader2, MessageSquare, Send, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgenticChatMessage, AgenticPhase } from '@/types'

export interface StepChatPanelProps {
  phase: AgenticPhase
  messages: AgenticChatMessage[]
  input: string
  chatLoading: boolean
  placeholder?: string
  onInputChange: (value: string) => void
  onSend: () => void
}

export function StepChatPanel({
  phase: _phase,
  messages,
  input,
  chatLoading,
  placeholder = 'Ask a question or request clarification...',
  onInputChange,
  onSend,
}: StepChatPanelProps) {
  const isEmpty = messages.length === 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-gray-700">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-900">Chat Assistant</span>
        </div>
        <span className="text-xs text-gray-500">
          optional — ask questions before validating
        </span>
      </div>

      {/* Messages and input */}
      <div className="p-4 space-y-4">
        {/* Messages */}
        <div className="bg-gray-50 rounded-lg p-4 min-h-[140px] max-h-52 overflow-y-auto border border-gray-200">
          {isEmpty ? (
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <p className="text-sm italic">
                No messages yet. Ask a question or go straight to Validate.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => (
                <ChatMessage key={`${msg.role}-${index}`} message={msg} />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSend()
                }
              }}
              placeholder={placeholder}
              rows={2}
              disabled={chatLoading}
              className={cn(
                'w-full px-4 py-3 bg-white border rounded-lg text-gray-900',
                'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50',
                'resize-none text-sm transition-all duration-200',
                'border-gray-300 focus:border-gray-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={chatLoading || !input.trim()}
            className={cn(
              'self-end inline-flex items-center justify-center gap-2 px-4 py-3',
              'rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium',
              'transition-all duration-200',
              'disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/50'
            )}
          >
            {chatLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({ message }: { message: AgenticChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser && 'flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
          isUser ? 'bg-gray-200 text-gray-700' : 'bg-gray-300 text-gray-600'
        )}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
      </div>
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-sm max-w-[85%]',
          isUser
            ? 'bg-gray-700 text-white rounded-tr-sm'
            : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200'
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}
