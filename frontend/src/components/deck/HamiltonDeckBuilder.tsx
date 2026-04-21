import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Pipette,
  Beaker,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeckConfig, CarrierPlacement, LabwareItem } from '@/types'
import { LabwareSelectionModal } from './LabwareSelectionModal'
import { apiRepository } from '@/lib/api/repositories'

// Export LabwarePreset type for use in other components
export type { LabwarePreset }

// ─── Labware Catalog (Biology-focused) ───────────────────────────────────────

interface LabwarePreset {
  id: string
  name: string
  type: 'tip_rack' | 'plate' | 'reservoir'
  icon: typeof FlaskConical
  color: string
  description: string
  defaultCount: number
}

const LABWARE_PRESETS: LabwarePreset[] = [
  {
    id: 'tips_300ul',
    name: '300µL Tips',
    type: 'tip_rack',
    icon: Pipette,
    color: 'bg-gray-50 text-gray-700 border-gray-300',
    description: 'Standard 96-tip rack (300µL)',
    defaultCount: 2,
  },
  {
    id: 'tips_1000ul',
    name: '1000µL Tips',
    type: 'tip_rack',
    icon: Pipette,
    color: 'bg-gray-50 text-gray-700 border-gray-300',
    description: '96-tip rack (1000µL)',
    defaultCount: 1,
  },
  {
    id: 'plate_96',
    name: '96-Well Plate',
    type: 'plate',
    icon: FlaskConical,
    color: 'bg-gray-50 text-gray-700 border-gray-300',
    description: 'Standard ANSI/SLAS 96-well plate',
    defaultCount: 2,
  },
  {
    id: 'plate_384',
    name: '384-Well Plate',
    type: 'plate',
    icon: FlaskConical,
    color: 'bg-gray-50 text-gray-700 border-gray-300',
    description: '384-well plate for high-throughput',
    defaultCount: 1,
  },
  {
    id: 'reservoir',
    name: 'Reagent Reservoir',
    type: 'reservoir',
    icon: Beaker,
    color: 'bg-gray-50 text-gray-700 border-gray-300',
    description: '300mL trough for reagents',
    defaultCount: 1,
  },
]

// ─── Carrier Definitions ───────────────────────────────────────────────────────

interface CarrierDefinition {
  id: string
  name: string
  slots: number
  widthRails: number
  accepts: LabwarePreset['type'][]
  color: string
  // Backend enum value that should be sent to the API
  backendValue: string
}

// Map database category to frontend display color (minimalistic light theme)
function getCarrierColor(category: string): string {
  switch (category) {
    case 'tip':
      return 'border-gray-300 bg-gray-50'
    case 'plate':
      return 'border-gray-300 bg-gray-50'
    case 'reagent':
      return 'border-gray-300 bg-gray-50'
    default:
      return 'border-gray-300 bg-gray-50'
  }
}

// Map database accepts array to frontend types
function mapAcceptsToTypes(accepts: string[]): LabwarePreset['type'][] {
  return accepts.map(a => {
    if (a === 'tip_rack') return 'tip_rack'
    if (a === 'plate' || a === 'deep_well') return 'plate'
    if (a === 'reservoir' || a === 'trough') return 'reservoir'
    return 'plate' // default
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HamiltonDeckBuilderProps {
  value: DeckConfig | null
  onChange: (deck: DeckConfig) => void
}

export function HamiltonDeckBuilder({ value, onChange }: HamiltonDeckBuilderProps) {
  const [labwareModalOpen, setLabwareModalOpen] = useState(false)
  const [modalSlotTarget, setModalSlotTarget] = useState<{
    carrierIndex: number
    slotIndex: number
  } | null>(null)
  const [availableCarriers, setAvailableCarriers] = useState<CarrierDefinition[]>([])
  const [carriersLoading, setCarriersLoading] = useState(true)
  const [carriersError, setCarriersError] = useState<string | null>(null)

  // Fetch carriers from API on mount
  useEffect(() => {
    async function fetchCarriers() {
      try {
        setCarriersLoading(true)
        setCarriersError(null)
        const data = await apiRepository.labware.getCarriers()

        // Transform API response to CarrierDefinition format
        const carriers: CarrierDefinition[] = data.map(c => ({
          id: c.code,
          name: c.name,
          slots: c.num_slots,
          widthRails: c.width_rails,
          accepts: mapAcceptsToTypes(c.accepts),
          color: getCarrierColor(c.category),
          backendValue: c.code,
        }))

        setAvailableCarriers(carriers)
      } catch (error) {
        console.error('Failed to fetch carriers:', error)
        setCarriersError('Failed to load carrier types')
        // Fallback to hardcoded carriers on error
        setAvailableCarriers([
          {
            id: 'tip_carrier_5',
            name: 'Tip Carrier (5-position)',
            slots: 5,
            widthRails: 6,
            accepts: ['tip_rack'],
            color: 'border-blue-500/40 bg-blue-500/5',
            backendValue: 'TIP_CAR_480_A00',
          },
          {
            id: 'plate_carrier_5',
            name: 'Plate Carrier (5-position)',
            slots: 5,
            widthRails: 6,
            accepts: ['plate'],
            color: 'border-purple-500/40 bg-purple-500/5',
            backendValue: 'PLT_CAR_L5AC_A00',
          },
        ])
      } finally {
        setCarriersLoading(false)
      }
    }

    fetchCarriers()
  }, [])

  // Initialize with default carriers if empty
  const deck = useMemo(() => {
    if (value) return value
    return {
      carriers: [],
      aspiration_settings: {
        volume_ul: 100,
        flow_rate_ul_per_s: 100,
        mix_cycles: 0,
        mix_volume_ul: 0,
        liquid_class: 'Water',
        tip_type: '300uL',
        pre_wet: false,
        touch_off: true,
      },
      total_rails: 55,
    }
  }, [value])

  const carriers = deck.carriers

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const updateDeck = useCallback((updates: Partial<DeckConfig>) => {
    onChange({ ...deck, ...updates })
  }, [deck, onChange])

  const addCarrier = useCallback((carrierDef: CarrierDefinition, startRail: number) => {
    const newCarrier: CarrierPlacement = {
      carrier_type: carrierDef.backendValue,
      start_rail: startRail,
      slots: Array(carrierDef.slots).fill(null),
    }
    updateDeck({ carriers: [...carriers, newCarrier] })
  }, [carriers, updateDeck])

  const removeCarrier = useCallback((index: number) => {
    updateDeck({ carriers: carriers.filter((_, i) => i !== index) })
  }, [carriers, updateDeck])

  const updateCarrierRail = useCallback((index: number, newRail: number) => {
    const updated = carriers.map((c, i) =>
      i === index ? { ...c, start_rail: newRail } : c
    )
    updateDeck({ carriers: updated })
  }, [carriers, updateDeck])

  const addLabwareToCarrier = useCallback((
    carrierIndex: number,
    slotIndex: number,
    labware: LabwarePreset
  ) => {
    const item: LabwareItem = {
      type: labware.type,
      subtype: labware.id,
      name: labware.name,
    }
    const updated = carriers.map((c, ci) => {
      if (ci !== carrierIndex) return c
      const newSlots = [...c.slots]
      newSlots[slotIndex] = item
      return { ...c, slots: newSlots }
    })
    updateDeck({ carriers: updated })
  }, [carriers, updateDeck])

  const openLabwareModal = useCallback((carrierIndex: number, slotIndex: number) => {
    setModalSlotTarget({ carrierIndex, slotIndex })
    setLabwareModalOpen(true)
  }, [])

  const handleLabwareSelect = useCallback((labware: LabwarePreset) => {
    if (modalSlotTarget) {
      addLabwareToCarrier(modalSlotTarget.carrierIndex, modalSlotTarget.slotIndex, labware)
      setModalSlotTarget(null)
    }
  }, [modalSlotTarget, addLabwareToCarrier])

  const removeLabwareFromCarrier = useCallback((carrierIndex: number, slotIndex: number) => {
    const updated = carriers.map((c, ci) => {
      if (ci !== carrierIndex) return c
      const newSlots = [...c.slots]
      newSlots[slotIndex] = null
      return { ...c, slots: newSlots }
    })
    updateDeck({ carriers: updated })
  }, [carriers, updateDeck])

  // Calculate next available rail position
  const nextAvailableRail = useMemo(() => {
    if (carriers.length === 0) return 1
    let maxRail = 0
    carriers.forEach(c => {
      const carrierDef = availableCarriers.find(car => car.backendValue === c.carrier_type)
      if (carrierDef) {
        const endRail = c.start_rail + carrierDef.widthRails
        if (endRail > maxRail) maxRail = endRail
      }
    })
    return maxRail + 1 // Leave 1 rail gap
  }, [carriers, availableCarriers])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">Hamilton Deck Layout</h3>
          <span className="text-xs text-gray-500">
            {carriers.length} carrier{carriers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Add Carrier Section */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">Add Carrier</h4>
          <span className="text-xs text-gray-500">
            Next position: Rail {nextAvailableRail}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {carriersLoading ? (
            <div className="col-span-full flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading carriers...</span>
            </div>
          ) : carriersError ? (
            <div className="col-span-full text-center py-4">
              <span className="text-sm text-red-600">{carriersError}</span>
            </div>
          ) : (
            availableCarriers.map((carrier) => (
              <button
                key={carrier.id}
                type="button"
                onClick={() => addCarrier(carrier, nextAvailableRail)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                  'hover:border-gray-400 hover:bg-gray-50',
                  carrier.color
                )}
              >
                <span className="text-xs font-medium text-gray-700">
                  {carrier.name}
                </span>
                <span className="text-[10px] text-gray-500">
                  {carrier.slots} slots · {carrier.widthRails} rails
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Carriers List */}
      <div className="space-y-3">
        <AnimatePresence>
          {carriers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200"
            >
              <Pipette className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm text-gray-600">No carriers on deck</p>
              <p className="text-xs mt-1 text-gray-500">Add a carrier above to get started</p>
            </motion.div>
          ) : (
            carriers.map((carrier, carrierIndex) => {
              const carrierDef = availableCarriers.find(c => c.backendValue === carrier.carrier_type)
              if (!carrierDef) return null

              return (
                <CarrierCard
                  key={`${carrier.carrier_type}-${carrier.start_rail}`}
                  carrier={carrier}
                  carrierDef={carrierDef}
                  railRange={{ start: carrier.start_rail, end: carrier.start_rail + carrierDef.widthRails }}
                  onRailChange={(rail) => updateCarrierRail(carrierIndex, rail)}
                  onRemove={() => removeCarrier(carrierIndex)}
                >
                  <div className="grid grid-cols-5 gap-2 mt-3">
                    {Array.from({ length: carrierDef.slots }).map((_, slotIndex) => (
                      <LabwareSlot
                        key={slotIndex}
                        item={carrier.slots[slotIndex]}
                        onAdd={() => openLabwareModal(carrierIndex, slotIndex)}
                        onRemove={() => removeLabwareFromCarrier(carrierIndex, slotIndex)}
                        labwarePresets={LABWARE_PRESETS.filter(p => carrierDef.accepts.includes(p.type))}
                      />
                    ))}
                  </div>
                </CarrierCard>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Summary */}
      {carriers.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-100 border border-gray-300 rounded-lg p-3 flex items-center gap-3"
        >
          <Check className="w-4 h-4 text-gray-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">Deck configured</p>
            <p className="text-xs text-gray-600">
              {carriers.reduce((sum, c) => sum + c.slots.filter(Boolean).length, 0)} labware items placed
            </p>
          </div>
        </motion.div>
      )}
    </div>

    {/* Labware selection modal */}
    <LabwareSelectionModal
      isOpen={labwareModalOpen}
      onClose={() => setLabwareModalOpen(false)}
      presets={LABWARE_PRESETS}
      onSelect={handleLabwareSelect}
    />
  </>
  )
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface CarrierCardProps {
  carrier: CarrierPlacement
  carrierDef: CarrierDefinition
  railRange: { start: number; end: number }
  onRailChange: (rail: number) => void
  onRemove: () => void
  children: React.ReactNode
}

function CarrierCard({ carrier, carrierDef, railRange, onRailChange, onRemove, children }: CarrierCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn('rounded-xl border p-4 bg-white shadow-sm transition-all', carrierDef.color)}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {carrierDef.name}
            </span>
            <span className="text-xs text-gray-500">
              Rails {railRange.start}-{railRange.end}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Position:</label>
              <input
                type="number"
                min={1}
                max={50}
                value={carrier.start_rail}
                onChange={(e) => onRailChange(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-0.5 bg-white border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-gray-500">
              {carrier.slots.filter(Boolean).length} / {carrierDef.slots} slots filled
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 hover:bg-red-50 rounded transition-colors group"
        >
          <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface LabwareSlotProps {
  item: LabwareItem | null
  onAdd: () => void
  onRemove: () => void
  labwarePresets: LabwarePreset[]
}

function LabwareSlot({ item, onAdd, onRemove, labwarePresets }: LabwareSlotProps) {
  const preset = item ? labwarePresets.find(p => p.id === item.subtype) : null
  const Icon = preset?.icon || FlaskConical

  return (
    <div className="relative aspect-square">
      {item ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'relative aspect-square rounded-lg border p-2 flex flex-col items-center justify-center gap-1 bg-white shadow-sm',
            preset?.color || 'border-gray-300 bg-white'
          )}
        >
          <Icon className="w-5 h-5 shrink-0 text-gray-700" />
          <span className="text-[10px] text-gray-600 text-center leading-tight line-clamp-2">
            {item.name}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 p-0.5 bg-gray-200 hover:bg-red-100 rounded-full transition-colors"
          >
            <X className="w-3 h-3 text-gray-600 hover:text-red-700" />
          </button>
        </motion.div>
      ) : (
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          type="button"
          onClick={onAdd}
          className="w-full h-full rounded-lg border border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100 transition-all flex flex-col items-center justify-center gap-1 group"
        >
          <Plus className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          <span className="text-[10px] text-gray-400 group-hover:text-gray-600 transition-colors">
            Add labware
          </span>
        </motion.button>
      )}
    </div>
  )
}
