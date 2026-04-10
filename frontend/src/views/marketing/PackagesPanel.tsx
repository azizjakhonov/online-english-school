import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Star, ToggleLeft, ToggleRight,
  Loader2, Package, TrendingUp, ChevronUp, ChevronDown, X, Check,
} from 'lucide-react'
import api from '../../lib/api'
import { usePageTitle } from '../../lib/usePageTitle'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditPackage {
  id: number
  name: string
  credits: number
  price_uzs: number
  is_active: boolean
  is_popular: boolean
  sort_order: number
  features: string[]
  validity_label: string
  sales_count: number
  revenue_uzs: number
  created_at: string
  updated_at: string
}

type PackageFormData = Omit<CreditPackage, 'id' | 'sales_count' | 'revenue_uzs' | 'created_at' | 'updated_at'>

const EMPTY_FORM: PackageFormData = {
  name: '',
  credits: 0,
  price_uzs: 0,
  is_active: true,
  is_popular: false,
  sort_order: 0,
  features: [],
  validity_label: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUZS(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M UZS`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K UZS`
  return `${v.toLocaleString()} UZS`
}

// ─── Package Modal ────────────────────────────────────────────────────────────

interface ModalProps {
  pkg?: CreditPackage
  onClose: () => void
  onSave: (data: PackageFormData) => void
  isSaving: boolean
}

function PackageModal({ pkg, onClose, onSave, isSaving }: ModalProps) {
  const [form, setForm] = useState<PackageFormData>(
    pkg
      ? {
          name:           pkg.name,
          credits:        pkg.credits,
          price_uzs:      pkg.price_uzs,
          is_active:      pkg.is_active,
          is_popular:     pkg.is_popular,
          sort_order:     pkg.sort_order,
          features:       [...pkg.features],
          validity_label: pkg.validity_label,
        }
      : EMPTY_FORM
  )
  const [featureInput, setFeatureInput] = useState('')

  const set = <K extends keyof PackageFormData>(k: K, v: PackageFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const addFeature = () => {
    const f = featureInput.trim()
    if (f && !form.features.includes(f)) {
      set('features', [...form.features, f])
    }
    setFeatureInput('')
  }

  const removeFeature = (idx: number) =>
    set('features', form.features.filter((_, i) => i !== idx))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...form,
      credits:   Number(form.credits),
      price_uzs: Number(form.price_uzs),
      sort_order: Number(form.sort_order),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-800">
            {pkg ? 'Edit Package' : 'New Package'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Package name</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              placeholder="e.g. Standard"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Credits + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Credits</label>
              <input
                type="number" min={1} required
                value={form.credits || ''}
                onChange={e => set('credits', Number(e.target.value))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Price (UZS)</label>
              <input
                type="number" min={0} required
                value={form.price_uzs || ''}
                onChange={e => set('price_uzs', Number(e.target.value))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Sort order + Validity label */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Sort order</label>
              <input
                type="number" min={0}
                value={form.sort_order}
                onChange={e => set('sort_order', Number(e.target.value))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Validity label (display only)</label>
              <input
                value={form.validity_label}
                onChange={e => set('validity_label', e.target.value)}
                placeholder="e.g. Valid 90 days"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-stone-700">Active (visible to students)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_popular}
                onChange={e => set('is_popular', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm text-stone-700">Show "Popular" badge</span>
            </label>
          </div>

          {/* Features */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Features (shown on card)</label>
            <div className="flex gap-2 mb-2">
              <input
                value={featureInput}
                onChange={e => setFeatureInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
                placeholder="e.g. Save 10%"
                className="flex-1 border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={addFeature}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.features.map((feat, idx) => (
                <span key={idx} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-lg">
                  {feat}
                  <button type="button" onClick={() => removeFeature(idx)} className="hover:text-blue-900">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {form.features.length === 0 && (
                <span className="text-xs text-stone-400">No features added yet</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-stone-200 text-stone-600 text-sm font-medium py-2 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {pkg ? 'Save Changes' : 'Create Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PackagesPanel() {
  usePageTitle('Credit Packages')
  const qc = useQueryClient()

  const [modalPkg, setModalPkg] = useState<CreditPackage | null | 'new'>('new' as any)
  const [showModal, setShowModal] = useState(false)

  const { data: packages = [], isLoading } = useQuery<CreditPackage[]>({
    queryKey: ['admin-packages'],
    queryFn: () => api.get('/api/payments/admin/packages/').then(r => r.data),
  })

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-packages'] }), [qc])

  const createMutation = useMutation({
    mutationFn: (data: PackageFormData) => api.post('/api/payments/admin/packages/', data),
    onSuccess: () => { invalidate(); setShowModal(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PackageFormData> }) =>
      api.patch(`/api/payments/admin/packages/${id}/`, data),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/payments/admin/packages/${id}/`),
    onSuccess: () => invalidate(),
  })

  const openNew = () => { setModalPkg(null); setShowModal(true) }
  const openEdit = (pkg: CreditPackage) => { setModalPkg(pkg); setShowModal(true) }

  const handleSave = (data: PackageFormData) => {
    if (modalPkg) {
      updateMutation.mutate({ id: (modalPkg as CreditPackage).id, data })
      setShowModal(false)
    } else {
      createMutation.mutate(data)
    }
  }

  const toggleActive = (pkg: CreditPackage) =>
    updateMutation.mutate({ id: pkg.id, data: { is_active: !pkg.is_active } })

  const togglePopular = (pkg: CreditPackage) => {
    // If making this one popular, unset others first — backend doesn't enforce uniqueness,
    // so we do a quick UI hint here; backend supports multiple popular flags
    updateMutation.mutate({ id: pkg.id, data: { is_popular: !pkg.is_popular } })
  }

  const handleMoveUp = (pkg: CreditPackage, idx: number) => {
    if (idx === 0) return
    const prev = packages[idx - 1]
    // Swap sort_order values
    updateMutation.mutate({ id: pkg.id, data: { sort_order: prev.sort_order } })
    updateMutation.mutate({ id: prev.id, data: { sort_order: pkg.sort_order } })
  }

  const handleMoveDown = (pkg: CreditPackage, idx: number) => {
    if (idx === packages.length - 1) return
    const next = packages[idx + 1]
    updateMutation.mutate({ id: pkg.id, data: { sort_order: next.sort_order } })
    updateMutation.mutate({ id: next.id, data: { sort_order: pkg.sort_order } })
  }

  const handleDelete = (pkg: CreditPackage) => {
    if (!confirm(`Deactivate "${pkg.name}"? It will be hidden from students but not permanently deleted.`)) return
    deleteMutation.mutate(pkg.id)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Summary stats
  const totalRevenue = packages.reduce((s, p) => s + p.revenue_uzs, 0)
  const totalSales   = packages.reduce((s, p) => s + p.sales_count, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
            <Package size={18} />
          </div>
          <h1 className="text-xl font-semibold text-stone-800">Credit Packages</h1>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> New Package
        </button>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Total packages</p>
          <p className="text-2xl font-bold text-stone-800">{packages.length}</p>
          <p className="text-xs text-stone-400 mt-0.5">{packages.filter(p => p.is_active).length} active</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Total sales</p>
          <p className="text-2xl font-bold text-stone-800">{totalSales}</p>
          <p className="text-xs text-stone-400 mt-0.5">All time, succeeded</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-start gap-3">
          <div className="p-2 bg-amber-50 rounded-xl text-amber-600 shrink-0 mt-0.5">
            <TrendingUp size={14} />
          </div>
          <div>
            <p className="text-xs text-stone-500 mb-1">Total revenue</p>
            <p className="text-xl font-bold text-stone-800">{fmtUZS(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="animate-spin text-stone-300 w-6 h-6" />
          </div>
        ) : packages.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-stone-400">
            <Package size={32} className="opacity-30" />
            <p className="text-sm">No packages yet. Create your first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">Order</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">Package</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Credits</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Price (UZS)</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Sales</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">Revenue</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, idx) => (
                  <tr key={pkg.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                    {/* Sort controls */}
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMoveUp(pkg, idx)}
                          disabled={idx === 0 || updateMutation.isPending}
                          className="p-0.5 text-stone-300 hover:text-stone-600 disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => handleMoveDown(pkg, idx)}
                          disabled={idx === packages.length - 1 || updateMutation.isPending}
                          className="p-0.5 text-stone-300 hover:text-stone-600 disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </td>

                    {/* Name + badges */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-stone-800">{pkg.name}</span>
                        {pkg.is_popular && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            <Star size={9} fill="currentColor" /> Popular
                          </span>
                        )}
                        {!pkg.is_active && (
                          <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Hidden
                          </span>
                        )}
                      </div>
                      {pkg.features.length > 0 && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate max-w-[180px]">
                          {pkg.features.join(' · ')}
                        </p>
                      )}
                    </td>

                    {/* Credits */}
                    <td className="px-5 py-3 text-sm text-right font-medium text-stone-700">{pkg.credits}</td>

                    {/* Price */}
                    <td className="px-5 py-3 text-sm text-right font-semibold text-stone-800">
                      {pkg.price_uzs.toLocaleString()}
                    </td>

                    {/* Sales */}
                    <td className="px-5 py-3 text-sm text-right text-stone-600">{pkg.sales_count}</td>

                    {/* Revenue */}
                    <td className="px-5 py-3 text-sm text-right font-medium text-stone-700">
                      {fmtUZS(pkg.revenue_uzs)}
                    </td>

                    {/* Status toggles */}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleActive(pkg)}
                          disabled={updateMutation.isPending}
                          title={pkg.is_active ? 'Active — click to hide' : 'Hidden — click to activate'}
                          className={`transition-colors ${pkg.is_active ? 'text-emerald-500 hover:text-emerald-700' : 'text-stone-300 hover:text-stone-500'}`}
                        >
                          {pkg.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                        <button
                          onClick={() => togglePopular(pkg)}
                          disabled={updateMutation.isPending}
                          title={pkg.is_popular ? 'Remove Popular badge' : 'Mark as Popular'}
                          className={`transition-colors ${pkg.is_popular ? 'text-amber-500 hover:text-amber-700' : 'text-stone-300 hover:text-amber-400'}`}
                        >
                          <Star size={16} fill={pkg.is_popular ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </td>

                    {/* Edit / Delete */}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(pkg)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(pkg)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                          title="Deactivate"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PackageModal
          pkg={modalPkg as CreditPackage | undefined}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  )
}
