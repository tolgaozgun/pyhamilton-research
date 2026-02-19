import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARRIER_CATALOG } from '@/types'
import type { CarrierPlacement } from '@/types'

interface AddCarrierDialogProps {
  existingCarriers: CarrierPlacement[]
  totalRails: number
  onAdd: (placement: CarrierPlacement) => void
}

function getOccupiedRails(carriers: CarrierPlacement[]): Set<number> {
  const occupied = new Set<number>()
  for (const c of carriers) {
    const cat = CARRIER_CATALOG[c.carrier_type]
    if (!cat) continue
    for (let r = c.start_rail; r < c.start_rail + cat.width_rails; r++) {
      occupied.add(r)
    }
  }
  return occupied
}

function getAvailableStartRails(
  carrierType: string,
  existingCarriers: CarrierPlacement[],
  totalRails: number
): number[] {
  const cat = CARRIER_CATALOG[carrierType]
  if (!cat) return []
  const occupied = getOccupiedRails(existingCarriers)
  const available: number[] = []

  for (let start = 1; start <= totalRails - cat.width_rails + 1; start++) {
    let fits = true
    for (let r = start; r < start + cat.width_rails; r++) {
      if (occupied.has(r)) {
        fits = false
        break
      }
    }
    if (fits) available.push(start)
  }
  return available
}

export function AddCarrierDialog({
  existingCarriers,
  totalRails,
  onAdd,
}: AddCarrierDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedRail, setSelectedRail] = useState<number | null>(null)

  const availableRails = useMemo(() => {
    if (!selectedType) return []
    return getAvailableStartRails(selectedType, existingCarriers, totalRails)
  }, [selectedType, existingCarriers, totalRails])

  const handleAdd = () => {
    if (!selectedType || selectedRail === null) return
    const cat = CARRIER_CATALOG[selectedType]
    if (!cat) return

    onAdd({
      carrier_type: selectedType,
      start_rail: selectedRail,
      slots: Array(cat.slots).fill(null) as null[],
    })
    setOpen(false)
    setSelectedType(null)
    setSelectedRail(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setSelectedType(null)
      setSelectedRail(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Carrier
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-50"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                  <Dialog.Title className="text-lg font-semibold text-zinc-100">
                    Add Carrier
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Carrier Type
                    </label>
                    <div className="space-y-1.5">
                      {Object.entries(CARRIER_CATALOG).map(([key, cat]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedType(key)
                            setSelectedRail(null)
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                            selectedType === key
                              ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                              : 'bg-zinc-800/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{cat.name}</span>
                            <span className="text-xs text-zinc-500">
                              {cat.width_rails} rails · {cat.slots} slots
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">{cat.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedType && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.15 }}
                    >
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Start Rail
                      </label>
                      {availableRails.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          No available positions for this carrier.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {availableRails.map((rail) => (
                            <button
                              key={rail}
                              type="button"
                              onClick={() => setSelectedRail(rail)}
                              className={cn(
                                'px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors',
                                selectedRail === rail
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                              )}
                            >
                              {rail}
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    disabled={!selectedType || selectedRail === null}
                    onClick={handleAdd}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add to Deck
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

export default AddCarrierDialog
