import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../../lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketingBanner {
  id: number
  title: string
  subtitle: string
  image: string | null
  image_url: string
  image_absolute_url: string | null
  cta_text: string
  cta_url: string
  cta_open_new_tab: boolean
  background_color: string
  text_color: string
  target_audience: 'student' | 'teacher' | 'both' | 'landing'
  banner_type: 'carousel' | 'announcement' | 'modal' | 'inline'
  is_active: boolean
  is_live: boolean
  order: number
  starts_at: string | null
  ends_at: string | null
  impressions: number
  clicks: number
  ctr: number
  created_by: number | null
  created_at: string
}

type BannerFormData = {
  title: string
  subtitle: string
  image_url: string
  cta_text: string
  cta_url: string
  cta_open_new_tab: boolean
  background_color: string
  text_color: string
  target_audience: MarketingBanner['target_audience']
  banner_type: MarketingBanner['banner_type']
  is_active: boolean
  starts_at: string
  ends_at: string
}

const EMPTY_FORM: BannerFormData = {
  title: '',
  subtitle: '',
  image_url: '',
  cta_text: '',
  cta_url: '',
  cta_open_new_tab: false,
  background_color: '#4f46e5',
  text_color: '#ffffff',
  target_audience: 'both',
  banner_type: 'carousel',
  is_active: true,
  starts_at: '',
  ends_at: '',
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function getBannerStatus(banner: MarketingBanner): { label: string; cls: string } {
  if (!banner.is_active) return { label: 'Inactive', cls: 'bg-stone-100 text-stone-500' }
  const now = new Date()
  if (banner.ends_at && new Date(banner.ends_at) < now)
    return { label: 'Expired', cls: 'bg-red-100 text-red-600' }
  if (banner.starts_at && new Date(banner.starts_at) > now)
    return { label: 'Scheduled', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Live', cls: 'bg-emerald-100 text-emerald-700' }
}

// ─── Sortable banner row ─────────────────────────────────────────────────────

interface SortableBannerRowProps {
  banner: MarketingBanner
  onEdit: (b: MarketingBanner) => void
  onDelete: (id: number) => void
  onToggle: (id: number, active: boolean) => void
}

function SortableBannerRow({ banner, onEdit, onDelete, onToggle }: SortableBannerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: banner.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const status = getBannerStatus(banner)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-stone-200 p-4 flex items-center gap-4"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>

      {/* Color swatch */}
      <div
        className="w-10 h-10 rounded-md shrink-0 border border-stone-200"
        style={{ backgroundColor: banner.background_color }}
      />

      {/* Title + audience */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-800 truncate">{banner.title}</p>
        <p className="text-xs text-stone-400 truncate">
          {banner.target_audience} · {banner.banner_type}
          {banner.subtitle ? ` · ${banner.subtitle}` : ''}
        </p>
      </div>

      {/* Status badge */}
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${status.cls}`}>
        {status.label}
      </span>

      {/* Stats */}
      <div className="hidden md:flex flex-col items-end text-xs text-stone-400 shrink-0 w-28">
        <span>{banner.impressions.toLocaleString()} views</span>
        <span>{banner.clicks.toLocaleString()} clicks · {banner.ctr}% CTR</span>
      </div>

      {/* Active toggle */}
      <button
        onClick={() => onToggle(banner.id, !banner.is_active)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
          ${banner.is_active ? 'bg-emerald-500' : 'bg-stone-200'}`}
        aria-label="Toggle active"
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
            ${banner.is_active ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(banner)}
          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
          aria-label="Edit"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(banner.id)}
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
}

// ─── Preview pane ────────────────────────────────────────────────────────────

function BannerPreview({ form }: { form: BannerFormData }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: form.background_color }}>
      <div className="p-6 flex flex-col gap-2 min-h-[100px]" style={{ color: form.text_color }}>
        {form.title ? (
          <p className="font-bold text-lg leading-tight">{form.title}</p>
        ) : (
          <p className="font-bold text-lg opacity-30">Banner title</p>
        )}
        {form.subtitle && <p className="text-sm opacity-80">{form.subtitle}</p>}
        {form.cta_text && (
          <span className="inline-block mt-1 px-4 py-1.5 text-sm font-medium rounded-full w-fit"
            style={{ backgroundColor: `${form.text_color}20`, border: `1px solid ${form.text_color}40` }}>
            {form.cta_text}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Create / Edit modal ─────────────────────────────────────────────────────

interface BannerModalProps {
  initial: BannerFormData
  onSave: (data: BannerFormData) => Promise<void>
  onClose: () => void
  saving: boolean
}

function BannerModal({ initial, onSave, onClose, saving }: BannerModalProps) {
  const [form, setForm] = useState<BannerFormData>(initial)

  const set = useCallback(<K extends keyof BannerFormData>(key: K, val: BannerFormData[K]) => {
    setForm(f => ({ ...f, [key]: val }))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">
            {initial.title ? 'Edit Banner' : 'New Banner'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 rounded-lg">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l14 14M16 2L2 16" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview */}
          <div>
            <p className="text-xs font-medium text-stone-500 mb-2 uppercase tracking-wide">Preview</p>
            <BannerPreview form={form} />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title *</label>
            <input
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Summer Sale — 20% off all credits"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Subtitle</label>
            <input
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.subtitle}
              onChange={e => set('subtitle', e.target.value)}
              placeholder="Supporting text"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Image URL</label>
            <input
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.image_url}
              onChange={e => set('image_url', e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">CTA Text</label>
              <input
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.cta_text}
                onChange={e => set('cta_text', e.target.value)}
                placeholder="Learn more"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">CTA URL</label>
              <input
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.cta_url}
                onChange={e => set('cta_url', e.target.value)}
                placeholder="/buy-credits"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.cta_open_new_tab}
              onChange={e => set('cta_open_new_tab', e.target.checked)}
              className="rounded"
            />
            Open CTA in new tab
          </label>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Background</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.background_color}
                  onChange={e => set('background_color', e.target.value)}
                  className="h-9 w-14 rounded border border-stone-200 cursor-pointer"
                />
                <input
                  className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.background_color}
                  onChange={e => set('background_color', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.text_color}
                  onChange={e => set('text_color', e.target.value)}
                  className="h-9 w-14 rounded border border-stone-200 cursor-pointer"
                />
                <input
                  className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.text_color}
                  onChange={e => set('text_color', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Target audience + type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Audience</label>
              <select
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.target_audience}
                onChange={e => set('target_audience', e.target.value as MarketingBanner['target_audience'])}
              >
                <option value="both">Both</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="landing">Landing Page</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Type</label>
              <select
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={form.banner_type}
                onChange={e => set('banner_type', e.target.value as MarketingBanner['banner_type'])}
              >
                <option value="carousel">Carousel Slide</option>
                <option value="announcement">Announcement Bar</option>
                <option value="modal">Modal Popup</option>
                <option value="inline">Inline Banner</option>
              </select>
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

          {/* Active */}
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="rounded"
            />
            Active
          </label>
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
            {saving ? 'Saving…' : 'Save Banner'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BannerManager() {
  const [banners, setBanners] = useState<MarketingBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; editing: MarketingBanner | null }>({
    open: false,
    editing: null,
  })
  const [saving, setSaving] = useState(false)
  const [filterAudience, setFilterAudience] = useState<string>('all')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Fetch banners ──────────────────────────────────────────────────────────
  const fetchBanners = useCallback(async () => {
    try {
      setError(null)
      const res = await api.get('/api/marketing/banners/')
      setBanners(res.data.results ?? res.data)
    } catch {
      setError('Failed to load banners.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBanners()
  }, [fetchBanners])

  // ── DnD reorder ────────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setBanners(prev => {
        const oldIdx = prev.findIndex(b => b.id === active.id)
        const newIdx = prev.findIndex(b => b.id === over.id)
        const next = arrayMove(prev, oldIdx, newIdx)

        // Persist new order via individual PATCHes
        next.forEach((b, i) => {
          api.patch(`/api/marketing/banners/${b.id}/`, { order: i }).catch(() => {})
        })

        return next
      })
    },
    [],
  )

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggle = useCallback(async (id: number, active: boolean) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: active } : b))
    try {
      await api.patch(`/api/marketing/banners/${id}/`, { is_active: active })
    } catch {
      // revert on failure
      setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: !active } : b))
    }
  }, [])

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('Delete this banner?')) return
    setBanners(prev => prev.filter(b => b.id !== id))
    try {
      await api.delete(`/api/marketing/banners/${id}/`)
    } catch {
      fetchBanners() // restore on failure
    }
  }, [fetchBanners])

  // ── Open edit modal ────────────────────────────────────────────────────────
  const handleEdit = useCallback((banner: MarketingBanner) => {
    setModal({ open: true, editing: banner })
  }, [])

  // ── Save (create or update) ────────────────────────────────────────────────
  const handleSave = useCallback(async (data: BannerFormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
      }

      if (modal.editing) {
        await api.patch(`/api/marketing/banners/${modal.editing.id}/`, payload)
      } else {
        await api.post('/api/marketing/banners/', payload)
      }
      setModal({ open: false, editing: null })
      await fetchBanners()
    } catch {
      // stay open on error
    } finally {
      setSaving(false)
    }
  }, [modal.editing, fetchBanners])

  // ── Build form initial from editing banner ─────────────────────────────────
  const modalInitial: BannerFormData = modal.editing
    ? {
        title: modal.editing.title,
        subtitle: modal.editing.subtitle,
        image_url: modal.editing.image_url,
        cta_text: modal.editing.cta_text,
        cta_url: modal.editing.cta_url,
        cta_open_new_tab: modal.editing.cta_open_new_tab,
        background_color: modal.editing.background_color,
        text_color: modal.editing.text_color,
        target_audience: modal.editing.target_audience,
        banner_type: modal.editing.banner_type,
        is_active: modal.editing.is_active,
        starts_at: modal.editing.starts_at
          ? modal.editing.starts_at.substring(0, 16)
          : '',
        ends_at: modal.editing.ends_at
          ? modal.editing.ends_at.substring(0, 16)
          : '',
      }
    : EMPTY_FORM

  const filtered = filterAudience === 'all'
    ? banners
    : banners.filter(b => b.target_audience === filterAudience || b.target_audience === 'both')

  // ── Summary stats ──────────────────────────────────────────────────────────
  const liveCount = banners.filter(b => getBannerStatus(b).label === 'Live').length
  const totalImpressions = banners.reduce((s, b) => s + b.impressions, 0)
  const totalClicks = banners.reduce((s, b) => s + b.clicks, 0)
  const avgCtr = totalImpressions > 0
    ? Math.round((totalClicks / totalImpressions) * 10000) / 100
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Banner Manager</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {liveCount} live · {totalImpressions.toLocaleString()} impressions · {avgCtr}% avg CTR
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, editing: null })}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          + New Banner
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-stone-200">
        {(['all', 'student', 'teacher', 'landing'] as const).map(aud => (
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

      {/* Banner list */}
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
          No banners yet.{' '}
          <button
            onClick={() => setModal({ open: true, editing: null })}
            className="text-amber-600 hover:underline"
          >
            Create one
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filtered.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filtered.map(banner => (
                <SortableBannerRow
                  key={banner.id}
                  banner={banner}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Legend */}
      {!loading && !error && filtered.length > 0 && (
        <p className="text-xs text-stone-400 flex items-center gap-1">
          <span>↕ Drag rows to reorder</span>
          <span className="mx-1">·</span>
          <span>Order is saved immediately</span>
        </p>
      )}

      {/* Modal */}
      {modal.open && (
        <BannerModal
          initial={modalInitial}
          onSave={handleSave}
          onClose={() => setModal({ open: false, editing: null })}
          saving={saving}
        />
      )}
    </div>
  )
}
