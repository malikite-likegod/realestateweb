'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ConversionData {
  month: string
  rate: number
}

interface ConversionChartProps {
  data: ConversionData[]
  height?: number
}

export function ConversionChart({ data, height = 280 }: ConversionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="conversionGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d4a517" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#d4a517" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 12, fill: '#9ca3af' }} />
        <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: '12px', border: '1px solid #f0f0f0' }} />
        <Area type="monotone" dataKey="rate" name="Conversion Rate" stroke="#d4a517" fill="url(#conversionGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
