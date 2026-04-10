import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthContext'
import api from '../../lib/api'

interface Banner {
  id: number
  title: string
  subtitle: string
  image_url: string
  image_absolute_url: string | null
  cta_text: string
  cta_url: string
  cta_open_new_tab: boolean
  background_color: string
  text_color: string
  banner_type: string
}

const SS_KEY = 'mktg_shown_modal_banners'

function getShown(): number[] {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '[]') } catch { return [] }
}

function markShown(id: number) {
  sessionStorage.setItem(SS_KEY, JSON.stringify([...getShown(), id]))
}

/**
 * ModalBanner — shows the highest-priority Banner with banner_type="modal" as a
 * full-screen overlay on first page load. Each banner is shown at most once per session.
 */
export default function ModalBanner() {
  const { user } = useAuth()
  const [activeBanner, setActiveBanner] = useState<Banner | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const audience =
    user?.role === 'student' ? 'student'
      : user?.role === 'teacher' ? 'teacher'
        : null

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ['marketing-banner-modal', audience],
    queryFn: () =>
      api
        .get(`/api/marketing/banners/active/?audience=${audience}&type=modal`)
        .then(r => r.data),
    enabled: !!audience,
    staleTime: 0,
  })

  // Pick the first unseen banner once data arrives
  useEffect(() => {
    if (activeBanner) return
    const shown = getShown()
    const next = banners.find(b => !shown.includes(b.id)) ?? null
    if (next) {
      markShown(next.id)
      api.post(`/api/marketing/banners/${next.id}/track-impression/`).catch(() => { })
      setActiveBanner(next)
    }
  }, [banners, activeBanner])

  if (!activeBanner || dismissed) return null

  const imageUrl = activeBanner.image_absolute_url || activeBanner.image_url || null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={() => setDismissed(true)}
    >
      <div
        className="relative max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: activeBanner.background_color }}
        onClick={e => e.stopPropagation()}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt={activeBanner.title}
            className="w-full object-cover max-h-64"
          />
        )}

        <div className="p-6" style={{ color: activeBanner.text_color }}>
          {activeBanner.title && (
            <h2 className="text-xl font-bold mb-1">{activeBanner.title}</h2>
          )}
          {activeBanner.subtitle && (
            <p className="text-sm opacity-80 mb-4">{activeBanner.subtitle}</p>
          )}
          {activeBanner.cta_text && (
            <a
              href={activeBanner.cta_url}
              target={activeBanner.cta_open_new_tab ? '_blank' : '_self'}
              rel="noopener noreferrer"
              onClick={() => {
                api.post(`/api/marketing/banners/${activeBanner.id}/track-click/`).catch(() => { })
                setDismissed(true)
              }}
              className="inline-block px-5 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors"
            >
              {activeBanner.cta_text}
            </a>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>
    </div>
  )
}
