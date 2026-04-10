import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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

/**
 * InlineBanner — renders all active Banner rows with banner_type="inline" for the
 * given audience as embedded cards inside page content.
 * Drop in anywhere with <InlineBanner audience="student" />.
 */
export function InlineBanner({ audience }: { audience: 'student' | 'teacher' }) {
  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ['marketing-banner-inline', audience],
    queryFn: () =>
      api
        .get(`/api/marketing/banners/active/?audience=${audience}&type=inline`)
        .then(r => r.data),
    staleTime: 0,
  })

  // Track impression for each banner on mount
  useEffect(() => {
    banners.forEach(b => {
      api.post(`/api/marketing/banners/${b.id}/track-impression/`).catch(() => { })
    })
  }, [banners])

  if (!banners.length) return null

  return (
    <div className="flex flex-col gap-3 mb-6">
      {banners.map(banner => {
        const imageUrl = banner.image_absolute_url || banner.image_url || null
        return (
          <div
            key={banner.id}
            className="rounded-xl overflow-hidden relative"
            style={{ backgroundColor: banner.background_color }}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div
              className="relative z-10 px-5 py-4 flex items-center gap-4"
              style={{ color: banner.text_color }}
            >
              <div className="flex-1 min-w-0">
                {banner.title && (
                  <p className="font-semibold text-sm">{banner.title}</p>
                )}
                {banner.subtitle && (
                  <p className="text-xs opacity-80 mt-0.5">{banner.subtitle}</p>
                )}
              </div>
              {banner.cta_text && (
                <a
                  href={banner.cta_url}
                  target={banner.cta_open_new_tab ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  onClick={() =>
                    api.post(`/api/marketing/banners/${banner.id}/track-click/`).catch(() => { })
                  }
                  className="shrink-0 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
                >
                  {banner.cta_text}
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
