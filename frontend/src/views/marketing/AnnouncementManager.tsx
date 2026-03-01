import { useState, useCallback, useEffect } from 'react'
import api from '../../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Announcement {
  id: number
  title: string
  body: string
  target_audience: 'student' | 'teacher' | 'both'
  is_active: boolean
  is_dismissible: boolean
  priority: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

type AnnouncementFormData = {
  title: string
  body: string
  target_audience: Announcement['target_audience']
  is_active: boolean
  is_dismissible: boolean
  priority: number
  starts_at: string
  ends_at: string
}

const EMPTY_FORM: AnnouncementFormData = {
  title: '',
  body: '',
  target_audience: 'both',
  is_active: true,
  is_dismissible: true,
  priority: 0,
  starts_at: '',
  ends_at: '',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function getStatus(ann: Announcement): { label: string; cls: string } {
  if (!ann.is_active) return { label: 'Inactive', cls: 'bg-stone-100 text-stone-500' }
  const now = new Date()
  if (ann.ends_at && new Date(ann.ends_at) < now)
    return { label: 'Expired', cls: 'bg-red-100 text-red-600' }
  if (ann.starts_at && new Date(ann.starts_at) > now)
    return { label: 'Scheduled', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Live', cls: 'bg-emerald-100 text-emerald-700' }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: AnnouncementFormData
  onSave: (data: AnnouncementFormData) => Promise<void>
  onClose: () => void
  saving: boolean
}

function AnnouncementModal({ initial, onSave, onClose, saving }: ModalProps) {
  const [form, setForm] = useState<AnnouncementFormData>(initial)

  const set = useCallback(<K extends keyof AnnouncementFormData>(key: K, val: AnnouncementFormData[K]) => {
    setForm(f => ({ ...f, [key]: val }))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">
            {initial.title ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 rounded-lg">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l14 14M16 2L2 16" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title *</label>
            <input
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. New feature available!"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Body</label>
            <textarea
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              rows={3}
              value={form.body}
              onChange={e => set('body', e.target.value)}
              placeholder="Additional details shown in the announcement bar"
            />
          </div>

          {/* Audience + priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Audience</label>
              <select
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.target_audience}
                onChange={e => set('target_audience', e.target.value as Announcement['target_audience'])}
              >
                <option value="both">Both</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Priority
                <span className="text-xs text-stone-400 font-normal ml-1">(higher = shown first)</span>
              </label>
              <input
                type="number"
                min={0}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.priority}
                onChange={e => set('priority', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Starts At</label>
              <input
                type="datetime-local"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.starts_at}
                onChange={e => set('starts_at', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Ends At</label>
              <input
                type="datetime-local"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.ends_at}
                onChange={e => set('ends_at', e.target.value)}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="rounded"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_dismissible}
                onChange={e => set('is_dismissible', e.target.checked)}
                className="rounded"
              />
              Dismissible (users can close it)
            </label>
          </div>

          {/* Preview */}
          {form.title && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2 uppercase tracking-wide">Preview</p>
              <div className="w-full bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-3 text-amber-900">
                <svg className="text-amber-500 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5zM8 11a.875.875 0 100 1.75A.875.875 0 008 11z" />
                </svg>
                <p className="text-sm flex-1">
                  <span className="font-semibold">{form.title}</span>
                  {form.body && <span className="text-amber-700 ml-1.5">— {form.body}</span>}
                </p>
                {form.is_dismissible && (
                  <span className="text-amber-400">✕</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim()}
            className="px-5 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Announcement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; editing: Announcement | null }>({
    open: false,
    editing: null,
  })
  const [saving, setSaving] = useState(false)
  const [filterAudience, setFilterAudience] = useState<string>('all')

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setError(null)
      const res = await api.get('/api/marketing/announcements/')
      setAnnouncements(res.data.results ?? res.data)
    } catch {
      setError('Failed to load announcements.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Toggle active ────────────────────────────────────────────────────────────
  const handleToggle = useCallback(async (id: number, active: boolean) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: active } : a))
    try {
      await api.patch(`/api/marketing/announcements/${id}/`, { is_active: active })
    } catch {
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !active } : a))
    }
  }, [])

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('Delete this announcement?')) return
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    try {
      await api.delete(`/api/marketing/announcements/${id}/`)
    } catch {
      fetchAll()
    }
  }, [fetchAll])

  // ── Save (create or update) ──────────────────────────────────────────────────
  const handleSave = useCallback(async (data: AnnouncementFormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      }
      if (modal.editing) {
        await api.patch(`/api/marketing/announcements/${modal.editing.id}/`, payload)
      } else {
        await api.post('/api/marketing/announcements/', payload)
      }
      setModal({ open: false, editing: null })
      await fetchAll()
    } catch {
      // stay open
    } finally {
      setSaving(false)
    }
  }, [modal.editing, fetchAll])

  const modalInitial: AnnouncementFormData = modal.editing
    ? {
        title: modal.editing.title,
        body: modal.editing.body,
        target_audience: modal.editing.target_audience,
        is_active: modal.editing.is_active,
        is_dismissible: modal.editing.is_dismissible,
        priority: modal.editing.priority,
        starts_at: modal.editing.starts_at ? modal.editing.starts_at.substring(0, 16) : '',
        ends_at: modal.editing.ends_at ? modal.editing.ends_at.substring(0, 16) : '',
      }
    : EMPTY_FORM

  const filtered = filterAudience === 'all'
    ? announcements
    : announcements.filter(a => a.target_audience === filterAudience || a.target_audience === 'both')

  const liveCount = announcements.filter(a => getStatus(a).label === 'Live').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Announcements</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {liveCount} live · {announcements.length} total
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, editing: null })}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          + New Announcement
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {(['all', 'student', 'teacher'] as const).map(aud => (
          <button
            key={aud}
            onClick={() => setFilterAudience(aud)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize
              ${filterAudience === aud
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'}`}
          >
            {aud === 'all' ? 'All' : aud.charAt(0).toUpperCase() + aud.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg border border-stone-200 p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-4">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-12 text-center text-stone-400 text-sm">
          No announcements yet.{' '}
          <button
            onClick={() => setModal({ open: true, editing: null })}
            className="text-amber-600 hover:underline"
          >
            Create one
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered
            .sort((a, b) => b.priority - a.priority)
            .map(ann => {
              const status = getStatus(ann)
              return (
                <div
                  key={ann.id}
                  className="bg-white rounded-lg border border-stone-200 p-4 flex items-start gap-4"
                >
                  {/* Priority badge */}
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500 shrink-0">
                    {ann.priority}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{ann.title}</p>
                    {ann.body && (
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{ann.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-stone-400 capitalize">{ann.target_audience}</span>
                      {ann.is_dismissible && (
                        <span className="text-xs text-stone-400">· Dismissible</span>
                      )}
                    </div>
                  </div>

                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggle(ann.id, !ann.is_active)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mt-0.5
                      ${ann.is_active ? 'bg-emerald-500' : 'bg-stone-200'}`}
                    aria-label="Toggle active"
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                        ${ann.is_active ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>

                  {/* Edit / Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setModal({ open: true, editing: ann })}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                      aria-label="Edit"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(ann.id)}
                      className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      aria-label="Delete"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h11M5 4V2h5v2M6 7v5M9 7v5M3 4l.8 9.2a1 1 0 001 .8h5.4a1 1 0 001-.8L12 4" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <AnnouncementModal
          initial={modalInitial}
          onSave={handleSave}
          onClose={() => setModal({ open: false, editing: null })}
          saving={saving}
        />
      )}
    </div>
  )
}
