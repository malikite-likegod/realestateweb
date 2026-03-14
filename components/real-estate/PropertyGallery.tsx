'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Grid3X3 } from 'lucide-react'

interface PropertyGalleryProps {
  images: string[]
  title: string
}

export function PropertyGallery({ images, title }: PropertyGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (images.length === 0) return null

  const prev = () => setCurrentIndex(i => (i === 0 ? images.length - 1 : i - 1))
  const next = () => setCurrentIndex(i => (i === images.length - 1 ? 0 : i + 1))

  return (
    <>
      {/* Grid preview */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[500px] rounded-2xl overflow-hidden">
        <div className="col-span-2 row-span-2 relative cursor-pointer" onClick={() => { setCurrentIndex(0); setLightboxOpen(true) }}>
          <Image src={images[0]} alt={title} fill className="object-cover hover:brightness-95 transition" sizes="50vw" />
        </div>
        {images.slice(1, 5).map((img, i) => (
          <div key={i} className="relative cursor-pointer" onClick={() => { setCurrentIndex(i + 1); setLightboxOpen(true) }}>
            <Image src={img} alt={`${title} ${i + 2}`} fill className="object-cover hover:brightness-95 transition" sizes="25vw" />
            {i === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white text-center">
                  <Grid3X3 size={24} className="mx-auto mb-1" />
                  <span className="text-sm font-medium">+{images.length - 5} more</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          >
            <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
              <X size={28} />
            </button>
            <button onClick={prev} className="absolute left-4 text-white/70 hover:text-white p-2">
              <ChevronLeft size={36} />
            </button>
            <button onClick={next} className="absolute right-16 text-white/70 hover:text-white p-2">
              <ChevronRight size={36} />
            </button>
            <div className="relative w-full max-w-5xl mx-16 aspect-[16/10]">
              <Image src={images[currentIndex]} alt={title} fill className="object-contain" sizes="90vw" />
            </div>
            <div className="absolute bottom-4 text-white/70 text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
