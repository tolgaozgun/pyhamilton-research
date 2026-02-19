import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface EventLogEvent {
  type: string
  title: string
  content?: string
  timestamp?: string
}

export interface EventLogProps {
  events: EventLogEvent[]
}

const getEventBorderColor = (type: string) => {
  if (type.includes('step')) return 'border-l-blue-500'
  if (type.includes('retry')) return 'border-l-amber-500'
  if (type.includes('success') || type.includes('complete')) return 'border-l-emerald-500'
  if (type.includes('error') || type.includes('failed')) return 'border-l-red-500'
  return 'border-l-zinc-700'
}

export function EventLog({ events }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events])

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
    >
      <AnimatePresence>
        {events.map((event, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'bg-zinc-900 border-l-4 rounded-r-lg p-3 border border-zinc-800 border-l-0',
              getEventBorderColor(event.type)
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100">{event.title}</div>
                {event.content && (
                  <div className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap break-words">
                    {event.content}
                  </div>
                )}
              </div>
              {event.timestamp && (
                <div className="text-xs text-zinc-500 whitespace-nowrap flex-shrink-0">
                  {event.timestamp}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default EventLog
