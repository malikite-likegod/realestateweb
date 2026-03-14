'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'

interface Testimonial {
  name: string
  location: string
  text: string
  rating: number
  photo?: string
}

interface TestimonialCarouselProps {
  testimonials: Testimonial[]
  autoPlay?: boolean
  interval?: number
}

export function TestimonialCarousel({ testimonials, autoPlay = true, interval = 5000 }: TestimonialCarouselProps) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!autoPlay) return
    const timer = setInterval(() => setCurrent(c => (c + 1) % testimonials.length), interval)
    return () => clearInterval(timer)
  }, [autoPlay, interval, testimonials.length])

  const prev = () => setCurrent(c => (c === 0 ? testimonials.length - 1 : c - 1))
  const next = () => setCurrent(c => (c + 1) % testimonials.length)

  const t = testimonials[current]
  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-3xl mx-auto px-12"
        >
          <div className="flex justify-center gap-0.5 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={18} className={i < t.rating ? 'text-gold-500 fill-gold-500' : 'text-charcoal-200'} />
            ))}
          </div>
          <blockquote className="font-serif text-xl sm:text-2xl text-charcoal-700 leading-relaxed italic mb-8">
            &ldquo;{t.text}&rdquo;
          </blockquote>
          <p className="font-medium text-charcoal-900">{t.name}</p>
          <p className="text-sm text-charcoal-400 mt-1">{t.location}</p>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <button onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-charcoal-400 hover:text-charcoal-900 transition-colors">
        <ChevronLeft size={24} />
      </button>
      <button onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-charcoal-400 hover:text-charcoal-900 transition-colors">
        <ChevronRight size={24} />
      </button>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? 'w-6 bg-charcoal-900' : 'w-1.5 bg-charcoal-300'}`}
          />
        ))}
      </div>
    </div>
  )
}
