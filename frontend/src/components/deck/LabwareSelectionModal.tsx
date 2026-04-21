import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LabwarePreset } from './HamiltonDeckBuilder'

interface LabwareSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  presets: LabwarePreset[]
  onSelect: (preset: LabwarePreset) => void
}

export function LabwareSelectionModal({
  isOpen,
  onClose,
  presets,
  onSelect,
}: LabwareSelectionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">Select Labware</h3>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    Choose the type of labware to place
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Labware options */}
              <div className="p-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-1 gap-2">
                  {presets.map((preset) => {
                    const Icon = preset.icon
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onSelect(preset)
                          onClose()
                        }}
                        className={cn(
                          'w-full flex items-center gap-4 p-4 rounded-xl border transition-all',
                          'hover:scale-[1.02] hover:shadow-lg',
                          preset.color
                        )}
                      >
                        <div className={cn(
                          'p-3 rounded-xl',
                          preset.color
                        )}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-zinc-100">{preset.name}</h4>
                            {preset.defaultCount > 1 && (
                              <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">
                                {preset.defaultCount}x default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 mt-0.5">{preset.description}</p>
                        </div>
                        <div className={cn(
                          'p-2 rounded-lg',
                          'bg-zinc-800/50 text-zinc-500',
                          'group-hover:bg-emerald-500/20 group-hover:text-emerald-400',
                          'transition-colors'
                        )}>
                          <Check className="w-5 h-5" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Hover over each option to see details. Click to select.</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
