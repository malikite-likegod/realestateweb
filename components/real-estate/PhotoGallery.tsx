'use client'

/**
 * PhotoGallery
 *
 * Hero image + thumbnail strip with a full-screen lightbox.
 * Keyboard: ← / → to navigate, Escape to close.
 */

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  images:        string[]
  address:       string
  badge?:        string
  badgeVariant?: 'green' | 'blue'
}

export function PhotoGallery({ images, address, badge, badgeVariant = 'green' }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const close = useCallback(() => setLightboxIndex(null), [])
  const prev  = useCallback(() => setLightboxIndex(i => i === null ? null : (i - 1 + images.length) % images.length), [images.length])
  const next  = useCallback(() => setLightboxIndex(i => i === null ? null : (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      close()
      if (e.key === 'ArrowLeft')   prev()
      if (e.key === 'ArrowRight')  next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, close, prev, next])

  if (images.length === 0) return null

  const badgeCls = badgeVariant === 'blue'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-emerald-100 text-emerald-700'

  const hasThumbs = images.length > 1

  return (
    <>
      {/* Hero */}
      <div
        className={`relative w-full h-96 rounded-2xl overflow-hidden bg-charcoal-100 cursor-pointer group ${hasThumbs ? 'mb-3' : 'mb-8'}`}
        onClick={() => setLightboxIndex(0)}
      >
        <img
          src={images[0]}
          alt={address}
          className="w-full h-full object-cover group-hover:scale-[1.015] transition-transform duration-300"
        />

        {badge && (
          <span className={`absolute top-4 left-4 text-xs font-semibold px-3 py-1.5 rounded-full shadow ${badgeCls}`}>
            {badge}
          </span>
        )}

        {/* Photo count pill — always visible */}
        {hasThumbs && (
          <span className="absolute bottom-4 right-4 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
            1 / {images.length} photos
          </span>
        )}

        {/* "Click to expand" hint */}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="bg-black/40 text-white text-sm font-medium px-4 py-2 rounded-full backdrop-blur-sm">
            Click to expand
          </span>
        </span>
      </div>

      {/* Thumbnail strip */}
      {hasThumbs && (
        <div className="grid grid-cols-6 gap-1.5 mb-8">
          {images.slice(1, 7).map((url, i) => (
            <div
              key={i}
              className="relative h-20 bg-charcoal-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setLightboxIndex(i + 1)}
            >
              <img src={url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover" />
              {i === 5 && images.length > 7 && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
                  <span className="text-white text-xs font-semibold">+{images.length - 7} more</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
          onClick={close}
        >
          {/* Close */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/75 transition-colors"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          {/* Prev / Next */}
          {hasThumbs && (
            <>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); prev() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/75 transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); next() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/75 transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight size={26} />
              </button>
            </>
          )}

          {/* Image */}
          <div
            className="flex flex-col items-center px-16 max-w-5xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex]}
              alt={`${address} — photo ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
            {hasThumbs && (
              <p className="mt-3 text-sm text-white/60 select-none">{lightboxIndex + 1} / {images.length}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
