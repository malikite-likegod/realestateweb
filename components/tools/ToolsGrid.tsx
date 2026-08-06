import { Calculator, TrendingUp, Home } from 'lucide-react'
import { ToolCard } from './ToolCard'

const TOOLS = [
  {
    icon: Calculator,
    title: 'Affordability & Approval Calculator',
    description: 'See what you could qualify for, including the mortgage stress test, minimum down payment, CMHC insurance, and estimated closing costs for your province.',
    href: '/tools/affordability-calculator',
    status: 'available' as const,
  },
  {
    icon: TrendingUp,
    title: 'Renovation ROI Estimator',
    description: 'Compare the estimated resale value added by common renovations against their typical cost.',
    href: '/tools/renovation-roi',
    status: 'comingSoon' as const,
  },
  {
    icon: Home,
    title: 'Rent vs. Buy Comparison',
    description: 'Compare your current rent against the estimated cost of buying a home nearby at a similar monthly payment.',
    href: '/tools/rent-vs-buy',
    status: 'available' as const,
  },
]

export function ToolsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {TOOLS.map(tool => (
        <ToolCard key={tool.title} {...tool} />
      ))}
    </div>
  )
}
