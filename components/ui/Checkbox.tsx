'use client'

import { forwardRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, id, ...props }, ref) => {
    const cbId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <label htmlFor={cbId} className="flex items-center gap-2.5 cursor-pointer select-none">
        <div className="relative">
          <input ref={ref} id={cbId} type="checkbox" className="sr-only peer" {...props} />
          <div className={cn(
            'h-4 w-4 rounded border border-charcoal-300 bg-white transition-colors',
            'peer-checked:bg-charcoal-900 peer-checked:border-charcoal-900',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-charcoal-900 peer-focus-visible:ring-offset-2',
            className,
          )}>
            <Check size={12} className="text-white absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100" />
          </div>
        </div>
        {label && <span className="text-sm text-charcoal-700">{label}</span>}
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'
