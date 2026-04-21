import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARRIER_CATALOG } from '@/types'
import type { CarrierPlacement, LabwareItem } from '@/types'
import { LabwareSlot } from './LabwareSlot'

interface CarrierBlockProps {
  placement: CarrierPlacement
  railWidth: number
  onSlotClick: (slotIndex: number, action: 'add' | 'edit', item?: LabwareItem) => void
  onSlotRemove: (slotIndex: number) => void
  onRemove: () => void
  compact?: boolean
}

const COLOR_MAP: Record<string, { bg: string; border: string; title: string }> = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    title: 'text-blue-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/40',
    title: 'text-purple-400',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    title: 'text-amber-400',
  },
}

export function CarrierBlock({
  placement,
  railWidth,
  onSlotClick,
  onSlotRemove,
  onRemove,
  compact = false,
}: CarrierBlockProps) {
  const catalog = CARRIER_CATALOG[placement.carrier_type]
  if (!catalog) return null

  const colors = COLOR_MAP[catalog.color] ?? COLOR_MAP.blue
  const widthPx = catalog.width_rails * railWidth

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'absolute top-0 bottom-0 rounded-lg border flex flex-col overflow-hidden',
        colors.bg,
        colors.border
      )}
      style={{
        left: `${(placement.start_rail - 1) * railWidth}px`,
        width: `${widthPx}px`,
      }}
    >
      <div
        className={cn(
          'flex items-center justify-between shrink-0 border-b',
          colors.border,
          compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
        )}
      >
        <div className="min-w-0">
          <h4
            className={cn(
              'font-semibold truncate',
              colors.title,
              compact ? 'text-[10px]' : 'text-xs'
            )}
          >
            {catalog.name}
          </h4>
          {!compact && (
            <p className="text-[10px] text-zinc-500 truncate">
              Rails {placement.start_rail}–{placement.start_rail + catalog.width_rails - 1}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <X className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </button>
      </div>

      <div className={cn('flex-1 overflow-y-auto space-y-0.5', compact ? 'p-1' : 'p-1.5')}>
        {placement.slots.map((slot, i) => (
          <LabwareSlot
            key={i}
            index={i}
            item={slot}
            accepts={catalog.accepts}
            onClick={(action, item) => onSlotClick(i, action, item)}
            onRemove={() => onSlotRemove(i)}
            compact={compact}
          />
        ))}
      </div>
    </motion.div>
  )
}

export default CarrierBlock
