'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className, id, ...props }, ref) => {
    const radioId = id ?? `radio-${props.value}`
    return (
      <label htmlFor={radioId} className="flex items-center gap-2.5 cursor-pointer select-none">
        <input ref={ref} id={radioId} type="radio"
          className={cn(
            'h-4 w-4 border-charcoal-300 text-charcoal-900',
            'focus:ring-charcoal-900 focus:ring-offset-2',
            className,
          )}
          {...props}
        />
        {label && <span className="text-sm text-charcoal-700">{label}</span>}
      </label>
    )
  }
)
Radio.displayName = 'Radio'
