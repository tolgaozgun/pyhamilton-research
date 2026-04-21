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

type CategoryFilter = 'all' | 'tip_rack' | 'plate' | 'reservoir' | 'tube'

const CATEGORY_INFO: Record<CategoryFilter, { label: string; icon: any; color: string; iconName: string }> = {
  all:       { label: 'All Types',   icon: Filter,   color: 'bg-gray-100 text-gray-600',   iconName: 'Filter' },
  tip_rack:  { label: 'Tip Racks',   icon: Pipette,  color: 'bg-blue-100 text-blue-600',   iconName: 'Pipette' },
  plate:     { label: 'Plates',      icon: Layers,   color: 'bg-purple-100 text-purple-600', iconName: 'Layers' },
  reservoir: { label: 'Reservoirs',  icon: Droplet,  color: 'bg-green-100 text-green-600', iconName: 'Droplet' },
  tube:      { label: 'Tubes',       icon: TestTube, color: 'bg-emerald-100 text-emerald-600', iconName: 'TestTube' },
}

function categoryIcon(category: string) {
  const icons: Record<string, any> = { tip_rack: Pipette, plate: Layers, reservoir: Droplet, tube: TestTube }
  return icons[category] || Layers
}

function categoryColor(category: string) {
  return CATEGORY_INFO[category as CategoryFilter]?.color ?? 'bg-gray-100 text-gray-600'
}

// ─── Card ──────────────────────────────────────────────────────────────────────

function LabwareCard({ labware, onEdit, onDelete }: {
  labware: LabwareItem
  onEdit: (labware: LabwareItem) => void
  onDelete: (id: number) => void
}) {
  const Icon = categoryIcon(labware.category)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'relative group rounded-xl border p-4 transition-all bg-white',
        'hover:shadow-md hover:scale-[1.02]',
        labware.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-60'
      )}
    >
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={() => onEdit(labware)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <Edit2 className="w-4 h-4 text-gray-400" />
        </button>
        <button type="button" onClick={() => onDelete(labware.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
        </button>
      </div>

      <div className={cn('p-3 rounded-xl w-fit mb-3', categoryColor(labware.category))}>
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="font-semibold text-gray-900 pr-16">{labware.name}</h3>
      {labware.description && (
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{labware.description}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full font-mono">
          {labware.code}
        </span>
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded-full capitalize">
          {labware.category.replace('_', ' ')}
        </span>
      </div>

      {!labware.is_active && (
        <div className="absolute bottom-3 left-4">
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded-full">Inactive</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Form Modal ────────────────────────────────────────────────────────────────

function LabwareFormModal({ labware, isOpen, onClose, onSave }: {
  labware?: LabwareItem
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<LabwareItem>) => Promise<void>
}) {
  const [formData, setFormData] = useState({
    name: labware?.name ?? '',
    code: labware?.code ?? '',
    category: labware?.category ?? 'plate',
    description: labware?.description ?? '',
    is_active: labware?.is_active ?? true,
  })
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when labware prop changes
  useEffect(() => {
    setFormData({
      name: labware?.name ?? '',
      code: labware?.code ?? '',
      category: labware?.category ?? 'plate',
      description: labware?.description ?? '',
      is_active: labware?.is_active ?? true,
    })
  }, [labware])

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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-md my-8"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {labware ? 'Edit Labware Type' : 'Add Labware Type'}
                </h3>
                <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                  <input
                    type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., 96-Well Plate"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Code * {labware && <span className="text-gray-400 font-normal">(cannot change)</span>}
                  </label>
                  <input
                    type="text" required value={formData.code}
                    disabled={!!labware}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., PLT_96_WELL"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                  <select
                    required value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                  >
                    <option value="plate">Plate</option>
                    <option value="tip_rack">Tip Rack</option>
                    <option value="reservoir">Reservoir</option>
                    <option value="tube">Tube</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={formData.description ?? ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50 resize-none"
                  />
                </div>

                {labware && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox" id="is_active" checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                  </div>
                )}
              </form>

              <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
                <button
                  type="button" onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit" onClick={handleSubmit} disabled={isSaving}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> {labware ? 'Update' : 'Create'}
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Labware Type?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to delete <span className="text-gray-900 font-medium">"{itemName}"</span>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button" onClick={onClose} disabled={isDeleting}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button" onClick={handleConfirm} disabled={isDeleting}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LabwarePage() {
  const { labware, isLoading, fetchLabware, createLabware, updateLabware, deleteLabware: deleteLabwareItem } = useLabwareItems()

  const [filteredLabware, setFilteredLabware] = useState<LabwareItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLabware, setEditingLabware] = useState<LabwareItem | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null; name: string }>({
    isOpen: false, id: null, name: '',
  })

  useEffect(() => {
    fetchLabware().catch(() => toast.error('Failed to load labware.'))
  }, [fetchLabware])

  useEffect(() => {
    let filtered = labware
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(lw => lw.category === selectedCategory)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(lw =>
        lw.name.toLowerCase().includes(q) ||
        lw.code.toLowerCase().includes(q) ||
        lw.category.toLowerCase().includes(q) ||
        (lw.description && lw.description.toLowerCase().includes(q))
      )
    }
    setFilteredLabware(filtered)
  }, [labware, searchQuery, selectedCategory])

  const handleSave = async (data: Partial<LabwareItem>) => {
    try {
      if (editingLabware) {
        await updateLabware(editingLabware.id, data)
        toast.success('Labware updated')
      } else {
        await createLabware(data)
        toast.success('Labware created')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save labware')
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
      toast.success('Labware deleted')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete labware')
      throw error
    }
  }

  const openCreateModal = () => {
    setEditingLabware(undefined)
    setIsFormOpen(true)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Labware Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            Labware types imported from deck layouts or created manually
          </p>
        </div>
        <button
          type="button" onClick={openCreateModal}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Labware Type
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, code or category..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {(Object.keys(CATEGORY_INFO) as CategoryFilter[]).map((cat) => {
            const info = CATEGORY_INFO[cat]
            const Icon = info.icon
            const count = cat === 'all' ? labware.length : labware.filter(lw => lw.category === cat).length
            return (
              <button
                key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  selectedCategory === cat
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon className="w-4 h-4" />
                {info.label}
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', selectedCategory === cat ? 'bg-white/20' : 'bg-gray-100 text-gray-500')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
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
                onDelete={(id) => setDeleteConfirm({ isOpen: true, id, name: item.name })}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No labware found</h3>
          <p className="text-sm text-gray-500 mb-6">
            {searchQuery || selectedCategory !== 'all'
              ? 'Try adjusting your filters'
              : 'Import a deck layout to automatically add labware types, or create one manually'}
          </p>
          {!searchQuery && selectedCategory === 'all' && (
            <button
              type="button" onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Labware Type
            </button>
          )}
        </div>
      )}

      <LabwareFormModal
        labware={editingLabware}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
      />
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={() => handleDelete(deleteConfirm.id!)}
        itemName={deleteConfirm.name}
      />
    </div>
  )
}
