import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthContext'
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
}

// ─── LocalStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = 'mktg_dismissed_annc'

function getDismissed(): number[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveDismissed(ids: number[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids))
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnnouncementBar() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState<number[]>(() => getDismissed())
  const [index, setIndex] = useState(0)

  // Determine audience param from user role
  const audience =
    user?.role === 'student' ? 'student'
      : user?.role === 'teacher' ? 'teacher'
        : null

  const { data: all = [] } = useQuery<Announcement[]>({
    queryKey: ['active-announcements', audience],
    queryFn: () =>
      api
        .get(`/api/marketing/announcements/active/?audience=${audience}`)
        .then(r => r.data),
    enabled: !!audience,
    staleTime: 0,
  })

  // Filter out dismissed entries
  const visible = all.filter(a => !dismissed.includes(a.id))

  // Reset index when visible list changes (e.g. after dismiss)
  useEffect(() => {
    setIndex(i => (visible.length === 0 ? 0 : Math.min(i, visible.length - 1)))
  }, [visible.length])

  const handleDismiss = useCallback(
    (id: number) => {
      const next = [...dismissed, id]
      setDismissed(next)
      saveDismissed(next)
    },
    [dismissed],
  )

  const handlePrev = useCallback(() => {
    setIndex(i => (i - 1 + visible.length) % visible.length)
  }, [visible.length])

  const handleNext = useCallback(() => {
    setIndex(i => (i + 1) % visible.length)
  }, [visible.length])

  if (!visible.length) return null

  const ann = visible[index]

  return (
    <div
      role="banner"
      className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3 text-amber-900"
    >
      {/* Icon */}
      <span className="text-amber-500 shrink-0" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5zM8 11a.875.875 0 100 1.75A.875.875 0 008 11z" />
        </svg>
      </span>

      {/* Text */}
      <p className="flex-1 text-sm min-w-0">
        <span className="font-semibold">{ann.title}</span>
        {ann.body && (
          <span className="text-amber-700 ml-1.5 hidden sm:inline truncate">
            — {ann.body}
          </span>
        )}
      </p>

      {/* Pagination (multiple announcements) */}
      {visible.length > 1 && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handlePrev}
            className="p-1 rounded hover:bg-amber-100 transition-colors"
            aria-label="Previous announcement"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2L4 6l4 4" />
            </svg>
          </button>
          <span className="text-xs text-amber-600 tabular-nums">
            {index + 1}/{visible.length}
          </span>
          <button
            onClick={handleNext}
            className="p-1 rounded hover:bg-amber-100 transition-colors"
            aria-label="Next announcement"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 2l4 4-4 4" />
            </svg>
          </button>
        </div>
      )}

      {/* Dismiss button */}
      {ann.is_dismissible && (
        <button
          onClick={() => handleDismiss(ann.id)}
          className="p-1 rounded hover:bg-amber-100 transition-colors shrink-0"
          aria-label="Dismiss announcement"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
