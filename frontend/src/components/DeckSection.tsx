/**
 * Shared collapsible deck layout + aspiration settings section.
 * Used in Simple, Developer, and Agentic pages.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react'
import { DeckLayout } from '@/components/deck/DeckLayout'
import { AspirationSettings } from '@/components/deck/AspirationSettings'
import type { CarrierPlacement, AspirationSettingsData, DeckConfig } from '@/types'
import { DEFAULT_ASPIRATION } from '@/types'

const DEFAULT_CARRIERS: CarrierPlacement[] = [
  {
    carrier_type: 'TIP_CAR_480_A00',
    start_rail: 1,
    slots: [
      { type: 'tip_rack', subtype: '300uL', name: 'Tips 300µL #1' },
      { type: 'tip_rack', subtype: '300uL', name: 'Tips 300µL #2' },
      null, null, null,
    ],
  },
  {
    carrier_type: 'PLT_CAR_L5AC_A00',
    start_rail: 7,
    slots: [
      { type: 'plate', subtype: '96_well', name: 'Source Plate' },
      { type: 'plate', subtype: '96_well', name: 'Dest Plate' },
      null, null, null,
    ],
  },
]

interface DeckSectionProps {
  onChange: (deck: DeckConfig) => void
  defaultOpen?: boolean
}

export function DeckSection({ onChange, defaultOpen = false }: DeckSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [carriers, setCarriers] = useState<CarrierPlacement[]>(DEFAULT_CARRIERS)
  const [aspiration, setAspiration] = useState<AspirationSettingsData>(DEFAULT_ASPIRATION)

  useEffect(() => {
    onChange({ carriers: DEFAULT_CARRIERS, aspiration_settings: DEFAULT_ASPIRATION, total_rails: 55 })
    // Emit the defaults once so consumers always have a usable initial deck config.
  }, [onChange])

  const handleCarriersChange = (next: CarrierPlacement[]) => {
    setCarriers(next)
    onChange({ carriers: next, aspiration_settings: aspiration, total_rails: 55 })
  }

  const handleAspirationChange = (next: AspirationSettingsData) => {
    setAspiration(next)
    onChange({ carriers, aspiration_settings: next, total_rails: 55 })
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <LayoutGrid className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-300">Deck Layout &amp; Settings</span>
          <span className="text-xs text-zinc-600 ml-1">
            {carriers.reduce((n, c) => n + c.slots.filter(Boolean).length, 0)} items placed
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-500" />
          : <ChevronDown className="w-4 h-4 text-zinc-500" />
        }
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="deck-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-800 px-5 pb-5 space-y-5">
              <div className="pt-4">
                <DeckLayout carriers={carriers} onChange={handleCarriersChange} />
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <AspirationSettings settings={aspiration} onChange={handleAspirationChange} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DeckSection
