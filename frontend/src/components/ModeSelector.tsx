import { motion } from 'framer-motion'
import { Zap, Code2, Bot } from 'lucide-react'
import { useAppStore } from '@/store'
import { MODE_INFO } from '@/types'
import type { Mode } from '@/types'
import { cn } from '@/lib/utils'

const iconMap = {
  Zap,
  Code2,
  Bot,
}

export function ModeSelector() {
  const { mode, setMode } = useAppStore()

  return (
    <div className="grid grid-cols-3 gap-4">
      {(Object.entries(MODE_INFO) as [Mode, typeof MODE_INFO[Mode]][]).map(([key, info]) => {
        const Icon = iconMap[info.icon as keyof typeof iconMap]
        const isActive = mode === key

        return (
          <motion.button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              'relative p-4 rounded-lg border-2 bg-zinc-900 transition-all text-left',
              isActive
                ? 'border-emerald-500 shadow-lg shadow-emerald-500/20'
                : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
            )}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
          >
            {isActive && (
              <motion.div
                layoutId="activeMode"
                className="absolute inset-0 rounded-lg border-2 border-emerald-500"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <Icon
                  className={cn(
                    'w-5 h-5',
                    isActive ? 'text-emerald-400' : 'text-zinc-500'
                  )}
                />
                <span
                  className={cn(
                    'font-semibold text-sm',
                    isActive ? 'text-emerald-400' : 'text-zinc-100'
                  )}
                >
                  {info.label}
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{info.description}</p>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

export default ModeSelector
