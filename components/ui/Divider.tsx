import { cn } from '@/lib/utils'

interface DividerProps {
  label?: string
  className?: string
}

export function Divider({ label, className }: DividerProps) {
  if (!label) return <hr className={cn('border-charcoal-200', className)} />
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <span className="flex-1 border-t border-charcoal-200" />
      <span className="text-xs text-charcoal-400 font-medium">{label}</span>
      <span className="flex-1 border-t border-charcoal-200" />
    </div>
  )
}
