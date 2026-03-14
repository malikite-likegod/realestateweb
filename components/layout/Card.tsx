import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  border?: boolean
}

const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' }

export function Card({ children, className, padding = 'md', hover = false, border = true }: CardProps) {
  return (
    <div className={cn(
      'rounded-2xl bg-white',
      border && 'border border-charcoal-100',
      'shadow-sm',
      hover && 'transition-shadow hover:shadow-md',
      paddings[padding],
      className,
    )}>
      {children}
    </div>
  )
}
