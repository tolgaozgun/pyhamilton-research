import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Edit2, Trash2, Search, Filter, Layers, Pipette, Droplet,
  TestTube, Check, X, RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useLabwareItems } from '@/lib/hooks/useLabwareItems'
import type { LabwareItem } from '@/lib/api/services/LabwareService'

type LabwareType = 'all' | 'tip_rack' | 'plate' | 'reservoir' | 'tube'

const LABWARE_TYPE_INFO: Record<LabwareType, { label: string; icon: any }> = {
  all: { label: 'All Types', icon: Filter },
  tip_rack: { label: 'Tip Racks', icon: Pipette },
  plate: { label: 'Plates', icon: Layers },
  reservoir: { label: 'Reservoirs', icon: Droplet },
  tube: { label: 'Tubes', icon: TestTube },
}

// ─── Components ────────────────────────────────────────────────────────────────────

function LabwareCard({ labware, onEdit, onDelete }: {
  labware: LabwareItem
  onEdit: (labware: LabwareItem) => void
  onDelete: (id: number) => void
}) {
  const Icon = {
    Pipette,
    Layers,
    Droplet,
    TestTube,
  }[labware.icon] || Layers

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'relative group rounded-xl border p-4 transition-all bg-white',
        'hover:shadow-md hover:scale-[1.02]',
        labware.is_active
          ? 'border-gray-200'
          : 'border-gray-200 bg-gray-50 opacity-60'
      )}
    >
      {/* Actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onEdit(labware)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Edit2 className="w-4 h-4 text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(labware.id)}
          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
        </button>
      </div>

      {/* Icon */}
      <div className={cn('p-3 rounded-xl w-fit mb-3', labware.color)}>
        <Icon className="w-6 h-6" />
      </div>

      {/* Info */}
      <h3 className="font-semibold text-gray-900 pr-16">{labware.name}</h3>
      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{labware.description}</p>

      {/* Details */}
      <div className="flex flex-wrap gap-2 mt-3">
        {labware.wells && (
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
            {labware.wells} wells
          </span>
        )}
        {labware.volume && (
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
            {labware.volume >= 1000 ? `${labware.volume / 1000}mL` : `${labware.volume}µL`}
          </span>
        )}
        {labware.subtype && (
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded-full">
            {labware.subtype}
          </span>
        )}
      </div>

      {/* Status badge */}
      {!labware.is_active && (
        <div className="absolute bottom-3 left-4">
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded-full">
            Inactive
          </span>
        </div>
      )}
    </motion.div>
  )
}

function LabwareFormModal({ labware, isOpen, onClose, onSave }: {
  labware?: LabwareItem
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<LabwareItem>) => Promise<void>
}) {
  const [formData, setFormData] = useState<{
    name: string
    type: string
    subtype: string
    description: string
    wells: number | null
    volume: number | null
    height: number | null
    color: string
    icon: string
    is_active: boolean
  }>({
    name: labware?.name ?? '',
    type: labware?.type ?? 'plate',
    subtype: labware?.subtype ?? '',
    description: labware?.description ?? '',
    wells: labware?.wells ?? 96,
    volume: labware?.volume ?? null,
    height: labware?.height ?? null,
    color: labware?.color ?? 'bg-gray-200 text-gray-600',
    icon: labware?.icon ?? 'Layers',
    is_active: labware?.is_active ?? true,
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save labware:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const COLORS = [
    { value: 'bg-gray-900 text-gray-100', label: 'Darkest', class: 'bg-gray-900' },
    { value: 'bg-gray-700 text-gray-100', label: 'Darker', class: 'bg-gray-700' },
    { value: 'bg-gray-500 text-white', label: 'Dark', class: 'bg-gray-500' },
    { value: 'bg-gray-300 text-gray-800', label: 'Medium', class: 'bg-gray-300' },
    { value: 'bg-gray-200 text-gray-600', label: 'Light', class: 'bg-gray-200' },
    { value: 'bg-gray-100 text-gray-500', label: 'Lighter', class: 'bg-gray-100' },
  ]

  const ICONS = [
    { value: 'Layers', label: 'Plate', icon: Layers },
    { value: 'Pipette', label: 'Tips', icon: Pipette },
    { value: 'Droplet', label: 'Reservoir', icon: Droplet },
    { value: 'TestTube', label: 'Tube', icon: TestTube },
  ]

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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-lg my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {labware ? 'Edit Labware' : 'Add New Labware'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., 96-Well Plate"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                  />
                </div>

                {/* Type & Subtype */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Type *
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                    >
                      <option value="plate">Plate</option>
                      <option value="tip_rack">Tip Rack</option>
                      <option value="reservoir">Reservoir</option>
                      <option value="tube">Tube</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Subtype
                    </label>
                    <input
                      type="text"
                      value={formData.subtype}
                      onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                      placeholder="e.g., 96, deep_96"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Description *
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this labware..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50 resize-none"
                  />
                </div>

                {/* Wells, Volume, Height */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Wells
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="384"
                      value={formData.wells ?? 0}
                      onChange={(e) => {
                        const val = e.target.value
                        const parsed = val ? parseInt(val, 10) : null
                        setFormData({ ...formData, wells: parsed })
                      }}
                      placeholder="96"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Volume (µL)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.volume ?? 0}
                      onChange={(e) => {
                        const val = e.target.value
                        const parsed = val ? parseInt(val, 10) : null
                        setFormData({ ...formData, volume: parsed })
                      }}
                      placeholder="200"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Height (mm)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.height ?? 0}
                      onChange={(e) => {
                        const val = e.target.value
                        const parsed = val ? parseFloat(val) : null
                        setFormData({ ...formData, height: parsed })
                      }}
                      placeholder="14.5"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                    />
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.value })}
                        className={cn(
                          'w-8 h-8 rounded-lg transition-all border border-gray-200',
                          color.class,
                          formData.color === color.value ? 'ring-2 ring-offset-2 ring-offset-white ring-gray-600' : 'opacity-60 hover:opacity-100'
                        )}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map((icon) => {
                      const IconComponent = icon.icon
                      return (
                        <button
                          key={icon.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon: icon.value })}
                          className={cn(
                            'p-2 rounded-lg border transition-all',
                            formData.icon === icon.value
                              ? 'bg-gray-900 border-gray-700 text-white'
                              : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
                          )}
                          title={icon.label}
                        >
                          <IconComponent className="w-5 h-5" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Active Status (only for edit) */}
                {labware && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-gray-700 focus:ring-gray-400/50 bg-white"
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700">
                      Active (visible in deck builder)
                    </label>
                  </div>
                )}
              </form>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg text-sm font-medium',
                    'bg-gray-900 hover:bg-gray-800 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      {labware ? 'Update' : 'Create'}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName }: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  itemName: string
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Labware?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to delete <span className="text-gray-900 font-medium">"{itemName}"</span>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isDeleting}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg text-sm font-medium',
                      'bg-red-600 hover:bg-red-500 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────────

export default function LabwarePage() {
  const {
    labware,
    isLoading,
    fetchLabware,
    createLabware,
    updateLabware,
    deleteLabware: deleteLabwareItem,
    seedLabware: seedLabwareItems,
  } = useLabwareItems()

  const [filteredLabware, setFilteredLabware] = useState<LabwareItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<LabwareType>('all')

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLabware, setEditingLabware] = useState<LabwareItem | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; name: string }>({
    isOpen: false,
    id: null,
    name: '',
  })

  // Seed default labware
  const seedLabware = async () => {
    try {
      await seedLabwareItems()
      toast.success('Default labware added successfully')
    } catch (error) {
      console.error('Failed to seed labware:', error)
      toast.error('Failed to add default labware')
    }
  }

  useEffect(() => {
    fetchLabware().catch((error) => {
      console.error('Failed to fetch labware:', error)
      toast.error('Failed to load labware. Please try again.')
    })
  }, [fetchLabware])

  // Filter labware based on search and type
  useEffect(() => {
    let filtered = labware

    if (selectedType !== 'all') {
      filtered = filtered.filter(lw => lw.type === selectedType)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(lw =>
        lw.name.toLowerCase().includes(query) ||
        lw.description.toLowerCase().includes(query) ||
        lw.type.toLowerCase().includes(query) ||
        (lw.subtype && lw.subtype.toLowerCase().includes(query))
      )
    }

    setFilteredLabware(filtered)
  }, [labware, searchQuery, selectedType])

  // Create/Update handlers
  const handleSave = async (data: Partial<LabwareItem>) => {
    try {
      if (editingLabware) {
        await updateLabware(editingLabware.id, data)
        toast.success('Labware updated successfully')
      } else {
        await createLabware(data)
        toast.success('Labware created successfully')
      }
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to save labware'
      toast.error(message)
      throw error
    }
  }

  const handleEdit = (item: LabwareItem) => {
    setEditingLabware(item)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteLabwareItem(id)
      toast.success('Labware deleted successfully')
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to delete labware'
      toast.error(message)
      throw error
    }
  }

  const openCreateModal = () => {
    setEditingLabware(undefined)
    setIsFormOpen(true)
  }

  const openDeleteModal = (id: number, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name })
  }

  const closeDeleteModal = () => {
    setDeleteConfirm({ isOpen: false, id: null, name: '' })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Labware Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage available labware for Hamilton deck configurations
          </p>
        </div>
        <div className="flex gap-2">
          {labware.length === 0 && !isLoading && (
            <button
              type="button"
              onClick={seedLabware}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Add Defaults
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Labware
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search labware..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(LABWARE_TYPE_INFO) as LabwareType[]).map((type) => {
            const info = LABWARE_TYPE_INFO[type]
            const Icon = info.icon
            const count = type === 'all'
              ? labware.length
              : labware.filter(lw => lw.type === type).length

            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  selectedType === type
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon className="w-4 h-4" />
                {info.label}
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  selectedType === type
                    ? 'bg-white/20'
                    : 'bg-gray-100 text-gray-500'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Labware Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading labware...</p>
          </div>
        </div>
      ) : filteredLabware.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredLabware.map((item) => (
              <LabwareCard
                key={item.id}
                labware={item}
                onEdit={handleEdit}
                onDelete={(id) => openDeleteModal(id, item.name)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No labware found</h3>
          <p className="text-sm text-gray-500 mb-6">
            {searchQuery || selectedType !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Get started by adding your first labware item'
            }
          </p>
          {!searchQuery && selectedType === 'all' && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Labware
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <LabwareFormModal
        labware={editingLabware}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
      />
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={closeDeleteModal}
        onConfirm={() => handleDelete(deleteConfirm.id!)}
        itemName={deleteConfirm.name}
      />
    </div>
  )
}
