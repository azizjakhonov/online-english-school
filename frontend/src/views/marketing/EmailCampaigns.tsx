import { memo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import api from '../../lib/api'
import {
  Plus, Send, Pencil, Trash2, Loader2, Mail, Users, CheckCircle, XCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailCampaign {
  id: number
  name: string
  subject: string
  preview_text: string
  html_body: string
  plain_text_body: string
  audience: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  scheduled_at: string | null
  sent_at: string | null
  recipients_count: number
  delivered_count: number
  bounced_count: number
  created_at: string
}

const AUDIENCE_LABELS: Record<string, string> = {
  all:              'All users',
  students:         'All students',
  teachers:         'All teachers',
  inactive_students:'Inactive students (30d)',
  new_signups:      'New sign-ups (7d)',
  paid_students:    'Paid students',
  free_students:    'Free students',
}

const STATUS_CLASSES: Record<string, string> = {
  draft:     'bg-stone-100 text-stone-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sending:   'bg-amber-100 text-amber-700',
  sent:      'bg-emerald-100 text-emerald-700',
  failed:    'bg-red-100 text-red-600',
}

// ─── Quill toolbar ────────────────────────────────────────────────────────────

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ],
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: Partial<EmailCampaign> | null
  onClose: () => void
  onSaved: () => void
}

const CampaignModal = memo(function CampaignModal({ initial, onClose, onSaved }: ModalProps) {
  const isEdit = !!initial?.id
  const [name, setName]             = useState(initial?.name ?? '')
  const [subject, setSubject]       = useState(initial?.subject ?? '')
  const [preview, setPreview]       = useState(initial?.preview_text ?? '')
  const [htmlBody, setHtmlBody]     = useState(initial?.html_body ?? '')
  const [plainText, setPlainText]   = useState(initial?.plain_text_body ?? '')
  const [audience, setAudience]     = useState(initial?.audience ?? 'all')
  const [scheduledAt, setScheduled] = useState(initial?.scheduled_at?.slice(0, 16) ?? '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const handleSave = useCallback(async () => {
    if (!name.trim() || !subject.trim() || !htmlBody.trim()) {
      setError('Name, subject and email body are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name, subject,
        preview_text: preview,
        html_body: htmlBody,
        plain_text_body: plainText,
        audience,
        scheduled_at: scheduledAt || null,
      }
      if (isEdit) {
        await api.patch(`/api/marketing/email-campaigns/${initial!.id}/`, payload)
      } else {
        await api.post('/api/marketing/email-campaigns/', payload)
      }
      onSaved()
    } catch {
      setError('Failed to save campaign.')
    } finally {
      setSaving(false)
    }
  }, [name, subject, preview, htmlBody, plainText, audience, scheduledAt, isEdit, initial, onSaved])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? 'Edit Campaign' : 'New Email Campaign'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Name + Audience */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Campaign name *</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. March re-engagement"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Audience *</label>
              <select
                value={audience} onChange={e => setAudience(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(AUDIENCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject + Preview */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Subject line *</label>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Your English learning journey starts now 🎉"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Preview text (inbox snippet)</label>
            <input
              value={preview} onChange={e => setPreview(e.target.value)}
              placeholder="Short teaser shown in inbox before opening…"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* HTML editor */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Email body (HTML) *</label>
            <div className="border border-stone-300 rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={htmlBody}
                onChange={setHtmlBody}
                modules={QUILL_MODULES}
                style={{ minHeight: 220 }}
              />
            </div>
          </div>

          {/* Plain text fallback */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Plain-text fallback <span className="font-normal text-stone-400">(use {'{name}'} for personalisation)</span>
            </label>
            <textarea
              value={plainText} onChange={e => setPlainText(e.target.value)}
              rows={4}
              placeholder="Hi {name}, we have exciting news for you…"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Schedule send (optional — leave blank to save as draft)</label>
            <input
              type="datetime-local" value={scheduledAt} onChange={e => setScheduled(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Footer */}
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

// ─── Campaign row ─────────────────────────────────────────────────────────────

interface RowProps {
  campaign: EmailCampaign
  onEdit: (c: EmailCampaign) => void
  onDelete: (id: number) => void
  onSend: (id: number) => void
  sending: boolean
}

const CampaignRow = memo(function CampaignRow({ campaign: c, onEdit, onDelete, onSend, sending }: RowProps) {
  const canSend = ['draft', 'scheduled', 'failed'].includes(c.status)
  const deliveryRate = c.recipients_count
    ? Math.round((c.delivered_count / c.recipients_count) * 100)
    : null

  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-stone-800 truncate max-w-xs">{c.name}</p>
        <p className="text-xs text-stone-400 truncate max-w-xs">{c.subject}</p>
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
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="w-3 h-3" />{c.bounced_count}
            </span>
            {deliveryRate !== null && (
              <span className="text-stone-400">({deliveryRate}%)</span>
            )}
          </div>
        ) : (
          <span className="text-stone-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-stone-400">
        {c.sent_at
          ? new Date(c.sent_at).toLocaleDateString()
          : c.scheduled_at
            ? `Scheduled ${new Date(c.scheduled_at).toLocaleDateString()}`
            : new Date(c.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {canSend && (
            <button
              onClick={() => onSend(c.id)}
              disabled={sending}
              title="Send now"
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send
            </button>
          )}
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

export default function EmailCampaigns() {
  const qc = useQueryClient()
  const [modalData, setModalData] = useState<Partial<EmailCampaign> | null | false>(false)
  const [sendingId, setSendingId] = useState<number | null>(null)

  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ['email-campaigns'],
    queryFn: () => api.get('/api/marketing/email-campaigns/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/marketing/email-campaigns/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-campaigns'] }),
  })

  const handleSend = useCallback(async (id: number) => {
    setSendingId(id)
    try {
      await api.post(`/api/marketing/email-campaigns/${id}/send/`)
      qc.invalidateQueries({ queryKey: ['email-campaigns'] })
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to send campaign.'
      alert(msg)
    } finally {
      setSendingId(null)
    }
  }, [qc])

  const handleDelete = useCallback((id: number) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return
    deleteMutation.mutate(id)
  }, [deleteMutation])

  const handleSaved = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['email-campaigns'] })
    setModalData(false)
  }, [qc])

  // ── Stats summary ──────────────────────────────────────────────────────────
  const totalSent      = campaigns.filter(c => c.status === 'sent').length
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered_count, 0)
  const totalRecip     = campaigns.reduce((s, c) => s + c.recipients_count, 0)
  const avgDelivery    = totalRecip ? Math.round((totalDelivered / totalRecip) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Email Campaigns</h1>
        <button
          onClick={() => setModalData({})}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </button>
      </div>

      {/* Summary cards */}
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-400">
            <Mail className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No campaigns yet. Create your first one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Campaign</th>
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
                    key={c.id}
                    campaign={c}
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

      {/* Modal */}
      {modalData !== false && (
        <CampaignModal
          initial={modalData}
          onClose={() => setModalData(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
