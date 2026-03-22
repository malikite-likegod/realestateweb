'use client'


import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/layout'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  className?: string
}

export function StatsCard({ title, value, change, changeLabel, icon, className }: StatsCardProps) {
  const positive = change != null && change >= 0
  return (
    <Card className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-charcoal-500 font-medium">{title}</p>
          <p className="mt-1 text-3xl font-bold text-charcoal-900 font-serif">{value}</p>
          {change != null && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', positive ? 'text-emerald-600' : 'text-red-500')}>
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(change)}% {changeLabel ?? 'vs last month'}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-charcoal-100 text-charcoal-600">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
