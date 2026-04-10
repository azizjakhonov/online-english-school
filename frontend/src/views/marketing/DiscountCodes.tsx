import { memo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import {
  Plus, Pencil, Trash2, Loader2, Tag, Copy, CheckCircle, ToggleLeft, ToggleRight,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscountCode {
  id: number
  code: string
  description: string
  discount_type: 'percent' | 'fixed' | 'free_credits'
  discount_value: string
  min_purchase_amount: string
  max_uses: number | null
  max_uses_per_user: number
  times_used: number
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  applicable_to: 'all' | 'new_users' | 'returning'
  campaign_ref: string
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  percent:     '% Off',
  fixed:       'Fixed UZS',
  free_credits: 'Free Credits',
}

const APPLICABLE_LABELS: Record<string, string> = {
  all:       'All users',
  new_users: 'New users only',
  returning: 'Returning users',
}

function formatValue(code: DiscountCode): string {
  const v = parseFloat(code.discount_value)
  if (code.discount_type === 'percent') return `${v}%`
  if (code.discount_type === 'fixed') return `${v.toLocaleString()} UZS`
  return `${v} credits`
}

function codeStatus(code: DiscountCode): { label: string; cls: string } {
  const now = new Date()
  if (!code.is_active) return { label: 'Inactive', cls: 'bg-stone-100 text-stone-500' }
  if (code.expires_at && new Date(code.expires_at) < now) return { label: 'Expired', cls: 'bg-red-100 text-red-600' }
  if (code.starts_at && new Date(code.starts_at) > now) return { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' }
  if (code.max_uses !== null && code.times_used >= code.max_uses) return { label: 'Used up', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' }
}

// ─── Copy helper ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])
  return (
    <button onClick={handleCopy} className="ml-1 text-stone-400 hover:text-stone-700 transition-colors" title="Copy code">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: Partial<DiscountCode> | null
  onClose: () => void
  onSaved: () => void
}

const CodeModal = memo(function CodeModal({ initial, onClose, onSaved }: ModalProps) {
  const isEdit = !!initial?.id
  const [code, setCode]           = useState(initial?.code ?? '')
  const [desc, setDesc]           = useState(initial?.description ?? '')
  const [type, setType]           = useState<string>(initial?.discount_type ?? 'percent')
  const [value, setValue]         = useState(initial?.discount_value ?? '')
  const [minAmount, setMinAmount] = useState(initial?.min_purchase_amount ?? '0')
  const [maxUses, setMaxUses]     = useState(initial?.max_uses?.toString() ?? '')
  const [maxPerUser, setMaxPerUser] = useState(initial?.max_uses_per_user?.toString() ?? '1')
  const [applicableTo, setApplicableTo] = useState<'all' | 'new_users' | 'returning'>(initial?.applicable_to ?? 'all')
  const [campaignRef, setCampaignRef]   = useState(initial?.campaign_ref ?? '')
  const [startsAt, setStartsAt]   = useState(initial?.starts_at?.slice(0, 16) ?? '')
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at?.slice(0, 16) ?? '')
  const [isActive, setIsActive]   = useState(initial?.is_active ?? true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const handleSave = useCallback(async () => {
    if (!code.trim() || !value) {
      setError('Code and discount value are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        description: desc,
        discount_type: type,
        discount_value: value,
        min_purchase_amount: minAmount || '0',
        max_uses: maxUses ? parseInt(maxUses) : null,
        max_uses_per_user: parseInt(maxPerUser) || 1,
        applicable_to: applicableTo,
        campaign_ref: campaignRef,
        starts_at: startsAt || null,
        expires_at: expiresAt || null,
        is_active: isActive,
      }
      if (isEdit) {
        await api.patch(`/api/marketing/discount-codes/${initial!.id}/`, payload)
      } else {
        await api.post('/api/marketing/discount-codes/', payload)
      }
      onSaved()
    } catch (err: any) {
      const detail = err?.response?.data
      if (typeof detail === 'object') {
        const first = Object.values(detail)[0]
        setError(Array.isArray(first) ? first[0] : String(first))
      } else {
        setError('Failed to save discount code.')
      }
    } finally {
      setSaving(false)
    }
  }, [code, desc, type, value, minAmount, maxUses, maxPerUser, applicableTo, campaignRef, startsAt, expiresAt, isActive, isEdit, initial, onSaved])

  const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? 'Edit Discount Code' : 'New Discount Code'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Code *</label>
            <input
              value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER20"
              className={inputCls + ' uppercase font-mono tracking-wider'}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Internal note" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Discount type *</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                <option value="percent">Percentage off (%)</option>
                <option value="fixed">Fixed amount (UZS)</option>
                <option value="free_credits">Free credits</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Value * {type === 'percent' ? '(%)' : type === 'fixed' ? '(UZS)' : '(credits)'}
              </label>
              <input
                type="number" min="0" value={value} onChange={e => setValue(e.target.value)}
                placeholder={type === 'percent' ? '20' : type === 'fixed' ? '100000' : '3'}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Min. purchase (UZS)</label>
              <input type="number" min="0" value={minAmount} onChange={e => setMinAmount(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Max per user</label>
              <input type="number" min="1" value={maxPerUser} onChange={e => setMaxPerUser(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Total uses (blank = unlimited)</label>
              <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Applicable to</label>
              <select value={applicableTo} onChange={e => setApplicableTo(e.target.value as 'all' | 'new_users' | 'returning')} className={inputCls}>
                {Object.entries(APPLICABLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Starts at</label>
              <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Expires at</label>
              <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Campaign / UTM ref</label>
            <input value={campaignRef} onChange={e => setCampaignRef(e.target.value)} placeholder="e.g. summer_2026_email" className={inputCls} />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsActive(v => !v)} className="text-stone-500 hover:text-stone-700 transition-colors">
              {isActive
                ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                : <ToggleLeft className="w-7 h-7 text-stone-300" />}
            </button>
            <span className="text-sm text-stone-600">{isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-stone-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create code'}
          </button>
        </div>
      </div>
    </div>
  )
})

// ─── Table row ────────────────────────────────────────────────────────────────

interface RowProps {
  code: DiscountCode
  onEdit: (c: DiscountCode) => void
  onDelete: (id: number) => void
  onToggle: (id: number, active: boolean) => void
}

const CodeRow = memo(function CodeRow({ code: c, onEdit, onDelete, onToggle }: RowProps) {
  const { label, cls } = codeStatus(c)
  const usageBar = c.max_uses ? Math.min((c.times_used / c.max_uses) * 100, 100) : 0

  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="font-mono font-bold text-stone-800 text-sm tracking-wider">{c.code}</span>
          <CopyButton text={c.code} />
        </div>
        {c.description && <p className="text-xs text-stone-400 mt-0.5 truncate max-w-[160px]">{c.description}</p>}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-stone-700">{formatValue(c)}</td>
      <td className="px-4 py-3 text-xs text-stone-500">{TYPE_LABELS[c.discount_type]}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
      </td>
      <td className="px-4 py-3">
        <div className="text-xs text-stone-600 mb-1">
          {c.times_used}{c.max_uses ? ` / ${c.max_uses}` : ''}
        </div>
        {c.max_uses && (
          <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${usageBar > 90 ? 'bg-red-400' : usageBar > 60 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${usageBar}%` }}
            />
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-stone-400">
        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => onToggle(c.id, !c.is_active)}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            title={c.is_active ? 'Deactivate' : 'Activate'}
          >
            {c.is_active
              ? <ToggleRight className="w-4 h-4 text-emerald-500" />
              : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEdit(c)}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(c.id)}
            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
})

// ─── Main view ────────────────────────────────────────────────────────────────

import { usePageTitle } from '../../lib/usePageTitle';

export default function DiscountCodes() {
  usePageTitle('Discount Codes');
  const qc = useQueryClient()
  const [modalData, setModalData] = useState<Partial<DiscountCode> | null | false>(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all')

  const { data: codes = [], isLoading } = useQuery<DiscountCode[]>({
    queryKey: ['discount-codes'],
    queryFn: () => api.get('/api/marketing/discount-codes/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/marketing/discount-codes/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.patch(`/api/marketing/discount-codes/${id}/`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-codes'] }),
  })

  const handleDelete = useCallback((id: number) => {
    if (!confirm('Delete this discount code? This cannot be undone.')) return
    deleteMutation.mutate(id)
  }, [deleteMutation])

  const handleToggle = useCallback((id: number, active: boolean) => {
    toggleMutation.mutate({ id, active })
  }, [toggleMutation])

  const handleSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['discount-codes'] })
    setModalData(false)
  }, [qc])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = codes.filter(c => {
    const { label } = codeStatus(c)
    if (filter === 'active')   return label === 'Active'
    if (filter === 'expired')  return label === 'Expired' || label === 'Used up'
    if (filter === 'inactive') return label === 'Inactive' || label === 'Scheduled'
    return true
  })

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeCodes   = codes.filter(c => codeStatus(c).label === 'Active').length
  const totalUses     = codes.reduce((s, c) => s + c.times_used, 0)
  const mostUsed      = codes.length ? [...codes].sort((a, b) => b.times_used - a.times_used)[0] : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Discount & Promo Codes</h1>
        <button
          onClick={() => setModalData({})}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New code
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Active codes</p>
          <p className="text-2xl font-bold text-emerald-600">{activeCodes}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Total redemptions</p>
          <p className="text-2xl font-bold text-stone-800">{totalUses}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Most used code</p>
          <p className="text-lg font-bold text-stone-800 font-mono tracking-wider">
            {mostUsed ? mostUsed.code : '—'}
          </p>
          {mostUsed && <p className="text-xs text-stone-400">{mostUsed.times_used} uses</p>}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit">
        {(['all', 'active', 'expired', 'inactive'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === tab ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400">
            <Tag className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">
              {filter === 'all' ? 'No discount codes yet. Create your first one.' : `No ${filter} codes.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Discount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Uses</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Expires</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <CodeRow
                    key={c.id}
                    code={c}
                    onEdit={cd => setModalData(cd)}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalData !== false && (
        <CodeModal
          initial={modalData}
          onClose={() => setModalData(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
