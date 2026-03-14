'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface LeadSourceData {
  source: string
  count: number
}

interface LeadSourceChartProps {
  data: LeadSourceData[]
  height?: number
}

const COLORS = ['#1a1a1a', '#d4a517', '#6366f1', '#10b981', '#ef4444', '#8b5cf6']

export function LeadSourceChart({ data, height = 280 }: LeadSourceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="count" nameKey="source">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f0f0f0' }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
