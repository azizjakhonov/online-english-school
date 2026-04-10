import { useState, useEffect } from 'react'
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

export function BannerCarousel({ audience }: { audience: 'student' | 'teacher' }) {
  const [index, setIndex] = useState(0)

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ['marketing-active-banners', audience, 'carousel'],
    queryFn: () =>
      api
        .get(`/api/marketing/banners/active/?audience=${audience}&type=carousel`)
        .then(r => r.data),
    staleTime: 0,
  })

  // Track impression when current banner changes
  useEffect(() => {
    if (banners[index]) {
      api
        .post(`/api/marketing/banners/${banners[index].id}/track-impression/`)
        .catch(() => { })
    }
  }, [index, banners])

  if (!banners.length) return null

  const banner = banners[index]
  const imageUrl = banner.image_absolute_url || banner.image_url || null

  return (
    <div
      className="rounded-xl overflow-hidden mb-6 relative group"
      style={{ backgroundColor: banner.background_color }}
    >
      {/* Background image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={banner.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Content */}
      <div className="relative z-10 p-6 flex items-center justify-between gap-4 min-h-[100px]"
        style={{ color: banner.text_color }}>
        <div className="space-y-1">
          {banner.title && (
            <h2 className="text-lg font-bold leading-tight">{banner.title}</h2>
          )}
          {banner.subtitle && (
            <p className="text-sm opacity-80">{banner.subtitle}</p>
          )}
          {banner.cta_text && (
            <a
              href={banner.cta_url}
              target={banner.cta_open_new_tab ? '_blank' : '_self'}
              rel="noopener noreferrer"
              onClick={() =>
                api
                  .post(`/api/marketing/banners/${banner.id}/track-click/`)
                  .catch(() => { })
              }
              className="inline-block mt-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
            >
              {banner.cta_text}
            </a>
          )}
        </div>

        {/* Pagination dots (multi-banner) */}
        {banners.length > 1 && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-1.5 rounded-full transition-all ${i === index ? 'h-5 bg-current' : 'h-1.5 bg-current opacity-40'
                  }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Prev/Next arrows (multi-banner) */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setIndex(i => (i - 1 + banners.length) % banners.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous banner"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 2L4 7l5 5" />
            </svg>
          </button>
          <button
            onClick={() => setIndex(i => (i + 1) % banners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next banner"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 2l5 5-5 5" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
