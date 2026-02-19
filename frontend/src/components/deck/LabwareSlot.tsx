import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, CircleDot, Boxes, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TIP_CATALOG,
  PLATE_CATALOG,
  RESERVOIR_CATALOG,
} from '@/types'
import type { LabwareItem } from '@/types'

interface LabwareSlotProps {
  index: number
  item: LabwareItem | null
  accepts: string[]
  onClick: (action: 'add' | 'edit', item?: LabwareItem) => void
  onRemove: () => void
  compact?: boolean
}

const LABWARE_ICONS: Record<string, typeof Boxes> = {
  tip_rack: CircleDot,
  plate: Boxes,
  reservoir: FlaskConical,
}

const LABWARE_COLORS: Record<string, string> = {
  tip_rack: 'text-blue-400',
  plate: 'text-purple-400',
  reservoir: 'text-amber-400',
}

function getCatalogForType(type: string): Record<string, string> {
  if (type === 'tip_rack') return TIP_CATALOG
  if (type === 'plate') return PLATE_CATALOG
  if (type === 'reservoir') return RESERVOIR_CATALOG
  return {}
}

function labwareTypeForAccepts(accepts: string[]): LabwareItem['type'] {
  if (accepts.includes('tip_rack')) return 'tip_rack'
  if (accepts.includes('reservoir')) return 'reservoir'
  return 'plate'
}

export function LabwareSlot({
  index,
  item,
  accepts,
  onClick,
  onRemove,
  compact = false,
}: LabwareSlotProps) {
  const [showPopover, setShowPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPopover])

  const handleSlotClick = () => {
    if (item) {
      setShowPopover(true)
    } else {
      setShowPopover(true)
    }
  }

  const handleAddLabware = (subtype: string, name: string) => {
    const type = labwareTypeForAccepts(accepts)
    onClick('add', { type, subtype, name })
    setShowPopover(false)
  }

  const Icon = item ? LABWARE_ICONS[item.type] ?? Boxes : Plus
  const iconColor = item ? LABWARE_COLORS[item.type] ?? 'text-zinc-400' : 'text-zinc-500'

  return (
    <div className="relative" ref={popoverRef}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSlotClick}
        className={cn(
          'w-full flex items-center gap-2 rounded-md transition-colors text-left',
          compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
          item
            ? 'bg-zinc-800/60 border border-zinc-700 hover:border-zinc-600'
            : 'border border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40'
        )}
      >
        <span className="text-[10px] font-mono text-zinc-500 w-3 shrink-0">
          {index + 1}
        </span>

        <Icon className={cn('shrink-0', iconColor, compact ? 'w-3 h-3' : 'w-3.5 h-3.5')} />

        {item ? (
          <div className="min-w-0 flex-1">
            <span className={cn('block truncate text-zinc-200', compact ? 'text-[10px]' : 'text-xs')}>
              {item.name}
            </span>
            {!compact && item.contents && (
              <span className="block text-[10px] text-zinc-500 truncate">
                {item.contents}
              </span>
            )}
          </div>
        ) : (
          <span className={cn('text-zinc-500', compact ? 'text-[10px]' : 'text-xs')}>
            Empty
          </span>
        )}

        {item && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="shrink-0 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </motion.button>

      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 top-full mt-1 w-52 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
          >
            {item ? (
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  Slot {index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClick('edit', item)
                    setShowPopover(false)
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded"
                >
                  Edit label
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemove()
                    setShowPopover(false)
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-red-400 hover:bg-zinc-800 rounded"
                >
                  Remove labware
                </button>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                <div className="px-2 py-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  Add to slot {index + 1}
                </div>
                {accepts.map((acceptType) => {
                  const catalog = getCatalogForType(acceptType)
                  return Object.entries(catalog).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleAddLabware(key, label)}
                      className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                    >
                      {label}
                    </button>
                  ))
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LabwareSlot
