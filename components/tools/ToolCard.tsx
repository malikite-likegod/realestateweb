import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/layout'
import { Badge } from '@/components/ui'
import { ArrowRight } from 'lucide-react'

export interface ToolCardProps {
  icon: LucideIcon
  title: string
  description: string
  href: string
  status?: 'available' | 'comingSoon'
}

export function ToolCard({ icon: Icon, title, description, href, status = 'available' }: ToolCardProps) {
  const isComingSoon = status === 'comingSoon'

  const content = (
    <Card padding="lg" hover={!isComingSoon} className="h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
          <Icon size={22} />
        </div>
        {isComingSoon && <Badge variant="default">Coming Soon</Badge>}
      </div>
      <h3 className="font-serif text-xl font-bold text-charcoal-900 mb-2">{title}</h3>
      <p className="text-sm text-charcoal-500 leading-relaxed flex-1">{description}</p>
      {!isComingSoon && (
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal-900">
          Try it <ArrowRight size={15} />
        </span>
      )}
    </Card>
  )

  if (isComingSoon) {
    return <div className="opacity-60 cursor-not-allowed">{content}</div>
  }

  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  )
}
