import { memo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import {
  Plus, Send, Pencil, Trash2, Loader2, Bell, Smartphone, Globe, Users, CheckCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PushCampaign {
  id: number
  name: string
  title: string
  body: string
  image_url: string
  deep_link: string
  platform: 'all' | 'web' | 'mobile'
  audience: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  scheduled_at: string | null
  sent_at: string | null
  recipients_count: number
  delivered_count: number
  opened_count: number
  created_at: string
}

const AUDIENCE_LABELS: Record<string, string> = {
  all:               'All users',
  students:          'All students',
  teachers:          'All teachers',
  inactive_students: 'Inactive students (30d)',
  new_signups:       'New sign-ups (7d)',
  paid_students:     'Paid students',
  free_students:     'Free students',
}

const PLATFORM_META: Record<string, { label: string; Icon: React.ElementType }> = {
  all:    { label: 'All platforms', Icon: Bell       },
  mobile: { label: 'Mobile (Expo)', Icon: Smartphone },
  web:    { label: 'Web browser',   Icon: Globe      },
}

const STATUS_CLASSES: Record<string, string> = {
  draft:     'bg-stone-100 text-stone-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sending:   'bg-amber-100 text-amber-700',
  sent:      'bg-emerald-100 text-emerald-700',
  failed:    'bg-red-100 text-red-600',
}

const CHAR_LIMIT = 178

// ─── Push preview ─────────────────────────────────────────────────────────────

function PushPreview({ title, body, image_url }: { title: string; body: string; image_url: string }) {
  return (
    <div className="bg-stone-100 rounded-xl p-3">
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Preview</p>
      <div className="bg-white rounded-xl shadow-sm p-3 flex gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-stone-800 truncate">{title || 'Notification title'}</p>
          <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{body || 'Your notification body goes here…'}</p>
          {image_url && (
            <img
              src={image_url} alt="" className="mt-2 w-full h-20 object-cover rounded-lg"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: Partial<PushCampaign> | null
  onClose: () => void
  onSaved: () => void
}

const CampaignModal = memo(function CampaignModal({ initial, onClose, onSaved }: ModalProps) {
  const isEdit = !!initial?.id
  const [name, setName]             = useState(initial?.name ?? '')
  const [title, setTitle]           = useState(initial?.title ?? '')
  const [body, setBody]             = useState(initial?.body ?? '')
  const [imageUrl, setImageUrl]     = useState(initial?.image_url ?? '')
  const [deepLink, setDeepLink]     = useState(initial?.deep_link ?? '')
  const [platform, setPlatform]     = useState<'all' | 'web' | 'mobile'>(initial?.platform ?? 'all')
  const [audience, setAudience]     = useState(initial?.audience ?? 'all')
  const [scheduledAt, setScheduled] = useState(initial?.scheduled_at?.slice(0, 16) ?? '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const bodyLen  = body.length
  const barColor = bodyLen > CHAR_LIMIT ? 'bg-red-500' : bodyLen > CHAR_LIMIT * 0.8 ? 'bg-amber-400' : 'bg-emerald-500'

  const handleSave = useCallback(async () => {
    if (!name.trim() || !title.trim() || !body.trim()) {
      setError('Name, title and body are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name, title, body,
        image_url: imageUrl,
        deep_link: deepLink,
        platform, audience,
        scheduled_at: scheduledAt || null,
      }
      if (isEdit) {
        await api.patch(`/api/marketing/push-campaigns/${initial!.id}/`, payload)
      } else {
        await api.post('/api/marketing/push-campaigns/', payload)
      }
      onSaved()
    } catch {
      setError('Failed to save campaign.')
    } finally {
      setSaving(false)
    }
  }, [name, title, body, imageUrl, deepLink, platform, audience, scheduledAt, isEdit, initial, onSaved])

  const inp = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? 'Edit Push Campaign' : 'New Push Campaign'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-2 gap-5">
          {/* Left column — fields */}
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Campaign name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly lesson reminder" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Notification title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Your lesson starts soon!" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Body *</label>
              <textarea
                value={body} onChange={e => setBody(e.target.value)} rows={4}
                placeholder="Short message shown in the notification…"
                className={inp + ' resize-none'}
              />
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min((bodyLen / CHAR_LIMIT) * 100, 100)}%` }} />
                </div>
                <span className="text-xs text-stone-400">{bodyLen}/{CHAR_LIMIT}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Image URL (optional)</label>
              <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…/image.jpg" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Deep link (optional)</label>
              <input value={deepLink} onChange={e => setDeepLink(e.target.value)} placeholder="myapp://lessons/123" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Platform</label>
                <select value={platform} onChange={e => setPlatform(e.target.value as 'all' | 'web' | 'mobile')} className={inp}>
                  <option value="all">All platforms</option>
                  <option value="mobile">Mobile (Expo)</option>
                  <option value="web">Web browser</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Audience</label>
                <select value={audience} onChange={e => setAudience(e.target.value)} className={inp}>
                  {Object.entries(AUDIENCE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Schedule (optional)</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduled(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Right column — preview + notes */}
          <div className="space-y-4">
            <PushPreview title={title} body={body} image_url={imageUrl} />
            <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-500 space-y-1">
              <p className="font-semibold text-stone-600">Requirements</p>
              <p>• Mobile: app installed with push permissions granted</p>
              <p>• Web: browser subscription required</p>
              <p>• Tokens registered via <code className="bg-stone-200 px-1 rounded">POST /api/marketing/push-tokens/</code></p>
            </div>
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
            {isEdit ? 'Save changes' : 'Create campaign'}
          </button>
        </div>
      </div>
    </div>
  )
})

// ─── Table row ────────────────────────────────────────────────────────────────

interface RowProps {
  campaign: PushCampaign
  onEdit: (c: PushCampaign) => void
  onDelete: (id: number) => void
  onSend: (id: number) => void
  sending: boolean
}

const CampaignRow = memo(function CampaignRow({ campaign: c, onEdit, onDelete, onSend, sending }: RowProps) {
  const canSend = ['draft', 'scheduled', 'failed'].includes(c.status)
  const { Icon: PlatformIcon } = PLATFORM_META[c.platform] ?? PLATFORM_META.all
  const deliveryRate = c.recipients_count
    ? Math.round((c.delivered_count / c.recipients_count) * 100)
    : null

  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-stone-800 truncate max-w-[200px]">{c.name}</p>
        <p className="text-xs text-stone-400 truncate max-w-[200px] font-medium">{c.title}</p>
      </td>
      <td className="px-4 py-3 text-xs text-stone-500">
        <span className="flex items-center gap-1">
          <PlatformIcon className="w-3 h-3" />
          {PLATFORM_META[c.platform]?.label ?? c.platform}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-stone-600">{AUDIENCE_LABELS[c.audience] ?? c.audience}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_CLASSES[c.status] ?? ''}`}>
          {c.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-stone-600">
        {c.recipients_count > 0 ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle className="w-3 h-3" />{c.delivered_count}
            </span>
            {deliveryRate !== null && <span className="text-stone-400">({deliveryRate}%)</span>}
          </div>
        ) : (
          <span className="text-stone-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-stone-400">
        {c.sent_at
          ? new Date(c.sent_at).toLocaleDateString()
          : c.scheduled_at
            ? `Sched. ${new Date(c.scheduled_at).toLocaleDateString()}`
            : new Date(c.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {canSend && (
            <button
              onClick={() => onSend(c.id)} disabled={sending}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send
            </button>
          )}
          <button onClick={() => onEdit(c)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(c.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
})

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PushCampaigns() {
  const qc = useQueryClient()
  const [modalData, setModalData] = useState<Partial<PushCampaign> | null | false>(false)
  const [sendingId, setSendingId] = useState<number | null>(null)

  const { data: campaigns = [], isLoading } = useQuery<PushCampaign[]>({
    queryKey: ['push-campaigns'],
    queryFn: () => api.get('/api/marketing/push-campaigns/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/marketing/push-campaigns/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-campaigns'] }),
  })

  const handleSend = useCallback(async (id: number) => {
    setSendingId(id)
    try {
      await api.post(`/api/marketing/push-campaigns/${id}/send/`)
      qc.invalidateQueries({ queryKey: ['push-campaigns'] })
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to send campaign.')
    } finally {
      setSendingId(null)
    }
  }, [qc])

  const handleDelete = useCallback((id: number) => {
    if (!confirm('Delete this push campaign? This cannot be undone.')) return
    deleteMutation.mutate(id)
  }, [deleteMutation])

  const handleSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['push-campaigns'] })
    setModalData(false)
  }, [qc])

  const totalSent      = campaigns.filter(c => c.status === 'sent').length
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered_count, 0)
  const totalRecip     = campaigns.reduce((s, c) => s + c.recipients_count, 0)
  const avgDelivery    = totalRecip ? Math.round((totalDelivered / totalRecip) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Push Notifications</h1>
        <button
          onClick={() => setModalData({})}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
        <Bell className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Push delivery requires registered device tokens. Mobile: register via{' '}
          <code className="bg-amber-100 px-1 rounded">usePushToken()</code> in the Expo app.
          Web: browser subscription flow → <code className="bg-amber-100 px-1 rounded">POST /api/marketing/push-tokens/</code>.
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Campaigns sent</p>
          <p className="text-2xl font-bold text-stone-800">{totalSent}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Total delivered</p>
          <p className="text-2xl font-bold text-emerald-600">{totalDelivered.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs text-stone-500 mb-1">Avg delivery rate</p>
          <p className="text-2xl font-bold text-stone-800">{avgDelivery}%</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400">
            <Bell className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No push campaigns yet. Create your first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Campaign</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Platform</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Audience</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />Delivery</span>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <CampaignRow
                    key={c.id} campaign={c}
                    onEdit={camp => setModalData(camp)}
                    onDelete={handleDelete}
                    onSend={handleSend}
                    sending={sendingId === c.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalData !== false && (
        <CampaignModal initial={modalData} onClose={() => setModalData(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
