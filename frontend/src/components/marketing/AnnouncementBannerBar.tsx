import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthContext'
import api from '../../lib/api'

interface Banner {
  id: number
  title: string
  subtitle: string
  cta_text: string
  cta_url: string
  cta_open_new_tab: boolean
  background_color: string
  text_color: string
  banner_type: string
}

const SS_KEY = 'mktg_dismissed_banner_annc'

function getDismissed(): number[] {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '[]') } catch { return [] }
}

function saveDismissed(ids: number[]) {
  sessionStorage.setItem(SS_KEY, JSON.stringify(ids))
}

/**
 * AnnouncementBannerBar — renders Banner model rows with banner_type="announcement".
 * Distinct from AnnouncementBar (which uses the separate Announcement model).
 * Dismissal is per-session (sessionStorage).
 */
export default function AnnouncementBannerBar() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState<number[]>(() => getDismissed())
  const [index, setIndex] = useState(0)

  const audience =
    user?.role === 'student' ? 'student'
      : user?.role === 'teacher' ? 'teacher'
        : null

  const { data: all = [] } = useQuery<Banner[]>({
    queryKey: ['marketing-banner-announcement', audience],
    queryFn: () =>
      api
        .get(`/api/marketing/banners/active/?audience=${audience}&type=announcement`)
        .then(r => r.data),
    enabled: !!audience,
    staleTime: 0,
  })

  const visible = all.filter(b => !dismissed.includes(b.id))

  useEffect(() => {
    setIndex(i => visible.length === 0 ? 0 : Math.min(i, visible.length - 1))
  }, [visible.length])

  // Track impression when current banner changes
  useEffect(() => {
    if (visible[index]) {
      api.post(`/api/marketing/banners/${visible[index].id}/track-impression/`).catch(() => { })
    }
  }, [index, visible])

  const handleDismiss = useCallback((id: number) => {
    const next = [...dismissed, id]
    setDismissed(next)
    saveDismissed(next)
  }, [dismissed])

  if (!visible.length) return null

  const banner = visible[index]

  return (
    <div
      role="banner"
      className="w-full px-4 py-2.5 flex items-center gap-3 text-sm"
      style={{ backgroundColor: banner.background_color, color: banner.text_color }}
    >
      <p className="flex-1 min-w-0 truncate">
        <span className="font-semibold">{banner.title}</span>
        {banner.subtitle && (
          <span className="opacity-80 ml-1.5 hidden sm:inline">— {banner.subtitle}</span>
        )}
      </p>

      {banner.cta_text && (
        <a
          href={banner.cta_url}
          target={banner.cta_open_new_tab ? '_blank' : '_self'}
          rel="noopener noreferrer"
          onClick={() =>
            api.post(`/api/marketing/banners/${banner.id}/track-click/`).catch(() => { })
          }
          className="shrink-0 px-3 py-1 rounded-md text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors"
        >
          {banner.cta_text}
        </a>
      )}

      {visible.length > 1 && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIndex(i => (i - 1 + visible.length) % visible.length)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            aria-label="Previous"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2L4 6l4 4" />
            </svg>
          </button>
          <span className="text-xs opacity-75 tabular-nums">{index + 1}/{visible.length}</span>
          <button
            onClick={() => setIndex(i => (i + 1) % visible.length)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            aria-label="Next"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 2l4 4-4 4" />
            </svg>
          </button>
        </div>
      )}

      <button
        onClick={() => handleDismiss(banner.id)}
        className="p-1 rounded hover:bg-white/20 transition-colors shrink-0"
        aria-label="Dismiss banner"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </div>
  )
}
