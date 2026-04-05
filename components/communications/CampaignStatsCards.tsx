import { Card } from '@/components/layout'

type StatCard = { label: string; value: string | number }
interface Props { stats: StatCard[] }

export function CampaignStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
      {stats.map(stat => (
        <Card key={stat.label} className="flex flex-col gap-1">
          <p className="text-2xl font-bold text-charcoal-900">{stat.value}</p>
          <p className="text-xs text-charcoal-500">{stat.label}</p>
        </Card>
      ))}
    </div>
  )
}
