'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrafficData {
  date: string
  visitors: number
  leads: number
}

interface TrafficChartProps {
  data: TrafficData[]
  height?: number
}

export function TrafficChart({ data, height = 280 }: TrafficChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f0f0f0' }} />
        <Bar dataKey="visitors" name="Visitors" fill="#e3e3e3" radius={[4, 4, 0, 0]} />
        <Bar dataKey="leads" name="Leads" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
