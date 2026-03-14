import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-1.5 text-sm text-charcoal-500', className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} className="text-charcoal-300" />}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-charcoal-900 transition-colors">{item.label}</Link>
          ) : (
            <span className={cn(i === items.length - 1 && 'text-charcoal-900 font-medium')}>{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
