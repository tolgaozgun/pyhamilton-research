import { useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARRIER_CATALOG } from '@/types'
import type { CarrierPlacement, LabwareItem } from '@/types'
import { CarrierBlock } from './CarrierBlock'
import { AddCarrierDialog } from './AddCarrierDialog'

interface DeckLayoutProps {
  carriers: CarrierPlacement[]
  onChange: (carriers: CarrierPlacement[]) => void
  totalRails?: number
  compact?: boolean
}

const RAIL_WIDTH = 48
const COMPACT_RAIL_WIDTH = 28
const DECK_HEIGHT = 360
const COMPACT_DECK_HEIGHT = 200

export function DeckLayout({
  carriers,
  onChange,
  totalRails = 55,
  compact = false,
}: DeckLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const railWidth = compact ? COMPACT_RAIL_WIDTH : RAIL_WIDTH
  const deckHeight = compact ? COMPACT_DECK_HEIGHT : DECK_HEIGHT
  const totalWidth = totalRails * railWidth

  const handleAddCarrier = useCallback(
    (placement: CarrierPlacement) => {
      onChange([...carriers, placement])
    },
    [carriers, onChange]
  )

  const handleRemoveCarrier = useCallback(
    (index: number) => {
      onChange(carriers.filter((_, i) => i !== index))
    },
    [carriers, onChange]
  )

  const handleSlotClick = useCallback(
    (
      carrierIndex: number,
      slotIndex: number,
      action: 'add' | 'edit',
      item?: LabwareItem
    ) => {
      if (action === 'add' && item) {
        const updated = carriers.map((c, ci) => {
          if (ci !== carrierIndex) return c
          const newSlots = [...c.slots]
          newSlots[slotIndex] = item
          return { ...c, slots: newSlots }
        })
        onChange(updated)
      } else if (action === 'edit' && item) {
        const label = window.prompt('Enter label for this labware:', item.contents ?? '')
        if (label === null) return
        const updated = carriers.map((c, ci) => {
          if (ci !== carrierIndex) return c
          const newSlots = [...c.slots]
          newSlots[slotIndex] = { ...item, contents: label || undefined }
          return { ...c, slots: newSlots }
        })
        onChange(updated)
      }
    },
    [carriers, onChange]
  )

  const handleSlotRemove = useCallback(
    (carrierIndex: number, slotIndex: number) => {
      const updated = carriers.map((c, ci) => {
        if (ci !== carrierIndex) return c
        const newSlots = [...c.slots]
        newSlots[slotIndex] = null
        return { ...c, slots: newSlots }
      })
      onChange(updated)
    },
    [carriers, onChange]
  )

  const railMarkers: number[] = []
  for (let r = 1; r <= totalRails; r++) {
    if (r % 5 === 0) railMarkers.push(r)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-zinc-400" />
          <h3 className={cn('font-semibold text-zinc-100', compact ? 'text-sm' : 'text-base')}>
            Deck Layout
          </h3>
          <span className="text-xs text-zinc-500">
            {carriers.length} carrier{carriers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <AddCarrierDialog
          existingCarriers={carriers}
          totalRails={totalRails}
          onAdd={handleAddCarrier}
        />
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900"
        style={{ scrollbarColor: '#3f3f46 #18181b' }}
      >
        <div className="relative" style={{ width: totalWidth, minHeight: deckHeight }}>
          {/* Grid lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={totalWidth}
            height={deckHeight}
          >
            {Array.from({ length: totalRails }, (_, i) => (
              <line
                key={i}
                x1={(i + 1) * railWidth}
                y1={0}
                x2={(i + 1) * railWidth}
                y2={deckHeight}
                stroke={i % 5 === 4 ? '#3f3f46' : '#27272a'}
                strokeWidth={i % 5 === 4 ? 1 : 0.5}
              />
            ))}
          </svg>

          {/* Carriers */}
          <div className="absolute inset-0" style={{ padding: compact ? 2 : 4 }}>
            <div className="relative w-full h-full">
              <AnimatePresence mode="popLayout">
                {carriers.map((carrier, idx) => {
                  const cat = CARRIER_CATALOG[carrier.carrier_type]
                  if (!cat) return null
                  return (
                    <CarrierBlock
                      key={`${carrier.carrier_type}-${carrier.start_rail}`}
                      placement={carrier}
                      railWidth={railWidth}
                      onSlotClick={(slotIdx, action, item) =>
                        handleSlotClick(idx, slotIdx, action, item)
                      }
                      onSlotRemove={(slotIdx) => handleSlotRemove(idx, slotIdx)}
                      onRemove={() => handleRemoveCarrier(idx)}
                      compact={compact}
                    />
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Rail markers */}
        <div
          className="relative border-t border-zinc-800"
          style={{ width: totalWidth, height: compact ? 20 : 28 }}
        >
          {railMarkers.map((rail) => (
            <span
              key={rail}
              className={cn(
                'absolute font-mono text-zinc-500 -translate-x-1/2',
                compact ? 'text-[8px] top-1' : 'text-[10px] top-1.5'
              )}
              style={{ left: (rail - 0.5) * railWidth }}
            >
              {rail}
            </span>
          ))}
        </div>
      </div>

      {carriers.length === 0 && (
        <p className="text-center text-sm text-zinc-500 py-4">
          No carriers on deck. Click &quot;Add Carrier&quot; to get started.
        </p>
      )}
    </div>
  )
}

export default DeckLayout
