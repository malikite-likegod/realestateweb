'use client'

import { cn } from '@/lib/utils'

export interface RangeSliderProps {
  label?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
  hint?: string
  className?: string
  id?: string
}

export function RangeSlider({ label, value, min, max, step = 1, onChange, formatValue, hint, className, id }: RangeSliderProps) {
  const sliderId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={sliderId} className="text-sm font-medium text-charcoal-700">
            {label}
          </label>
          <span className="text-sm font-semibold text-charcoal-900">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}
      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-gold-500
          [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-500 [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
          [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-gold-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md"
        style={{ background: `linear-gradient(to right, #d4a517 ${percent}%, #e3e3e3 ${percent}%)` }}
      />
      {hint && <p className="text-xs text-charcoal-500">{hint}</p>}
    </div>
  )
}
