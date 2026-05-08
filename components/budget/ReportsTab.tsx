'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
  LineChart,
} from 'recharts'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

type View = 'spending' | 'income-expenses' | 'net-worth'

function toMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function nAgo(n: number) {
  const d = new Date(); d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

// ── Spending by Category ──────────────────────────────────────────────────────

type SpendRow = { categoryId: string | null; categoryName: string; groupName: string; color: string; total: number }

function SpendingView() {
  const [from, setFrom]       = useState(nAgo(3))
  const [to, setTo]           = useState(() => toMonth())
  const [data, setData]       = useState<SpendRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const res  = await fetch(`/api/budget/reports/spending?from=${from}&to=${to}`)
    const json = await res.json()
    setData(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [from, to])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-400">From</label>
          <input
            type="month"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-400">To</label>
          <input
            type="month"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-charcoal-500 text-sm">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-charcoal-500 text-sm py-8 text-center">No expense data in this range</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
            <BarChart data={data} layout="vertical" margin={{ left: 130, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tickFormatter={fmt} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="categoryName" width={120} tick={{ fill: '#d1d5db', fontSize: 12 }} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="total" fill="#d4a93a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal-800">
                <th className="text-left px-3 py-2 text-xs text-charcoal-500 font-medium uppercase">Category</th>
                <th className="text-left px-3 py-2 text-xs text-charcoal-500 font-medium uppercase">Group</th>
                <th className="text-right px-3 py-2 text-xs text-charcoal-500 font-medium uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-charcoal-800/50">
                  <td className="px-3 py-2.5 text-white">{row.categoryName}</td>
                  <td className="px-3 py-2.5 text-charcoal-400">{row.groupName}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-white">{fmt(row.total)}</td>
                </tr>
              ))}
              <tr className="bg-charcoal-900/50">
                <td colSpan={2} className="px-3 py-2.5 text-charcoal-400 font-medium">Total</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gold-400">
                  {fmt(data.reduce((s, row) => s + row.total, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ── Income vs Expenses ────────────────────────────────────────────────────────

type IERow = { month: string; income: number; expenses: number; net: number }

function IncomeExpensesView() {
  const [from, setFrom]       = useState(nAgo(12))
  const [to, setTo]           = useState(() => toMonth())
  const [data, setData]       = useState<IERow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/budget/reports/income-expenses?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false) })
  }, [from, to])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-400">From</label>
          <input
            type="month"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-400">To</label>
          <input
            type="month"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-charcoal-500 text-sm">Loading…</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              formatter={(v: number) => fmt(v)}
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend wrapperStyle={{ color: '#d1d5db' }} />
            <Bar dataKey="income"   name="Income"   fill="#4ade80" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[2, 2, 0, 0]} />
            <Line dataKey="net" name="Net" stroke="#d4a93a" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Net Worth ─────────────────────────────────────────────────────────────────

type MoneyItem = { label: string; amount: number }
type NWEntry   = { id: string; month: string; assets: string; liabilities: string; totalAssets: number; totalLiabilities: number; netWorth: number }

function NetWorthView() {
  const [entries, setEntries]         = useState<NWEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [assets, setAssets]           = useState<MoneyItem[]>([{ label: '', amount: 0 }])
  const [liabilities, setLiabilities] = useState<MoneyItem[]>([{ label: '', amount: 0 }])
  const [saving, setSaving]           = useState(false)
  const editMonth = toMonth()

  async function loadEntries() {
    setLoading(true)
    const json = await fetch('/api/budget/networth').then(r => r.json())
    const data: NWEntry[] = json.data ?? []
    setEntries(data)
    const cur = data.find(e => e.month === editMonth)
    if (cur) { setAssets(JSON.parse(cur.assets)); setLiabilities(JSON.parse(cur.liabilities)) }
    setLoading(false)
  }

  useEffect(() => { loadEntries() }, [])

  function updAsset(i: number, field: keyof MoneyItem, v: string | number) {
    setAssets(assets.map((x, j) => j === i ? { ...x, [field]: v } : x))
  }

  function updLiability(i: number, field: keyof MoneyItem, v: string | number) {
    setLiabilities(liabilities.map((x, j) => j === i ? { ...x, [field]: v } : x))
  }

  async function save() {
    setSaving(true)
    await fetch('/api/budget/networth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: editMonth, assets, liabilities }),
    })
    setSaving(false)
    loadEntries()
  }

  const previewNet = assets.reduce((s, a) => s + (a.amount || 0), 0)
    - liabilities.reduce((s, l) => s + (l.amount || 0), 0)

  const chartData = entries.map(e => ({ month: e.month, netWorth: e.netWorth }))

  return (
    <div className="flex flex-col gap-6">
      {loading ? (
        <p className="text-charcoal-500 text-sm">Loading…</p>
      ) : (
        <>
          {chartData.length >= 2 && (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line dataKey="netWorth" name="Net Worth" stroke="#d4a93a" strokeWidth={2} dot={{ fill: '#d4a93a' }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Entry form */}
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl p-5 flex flex-col gap-5">
            <h3 className="text-white font-medium">Update {editMonth} Net Worth</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets */}
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-green-400">Assets</span>
                {assets.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={a.label}
                      onChange={e => updAsset(i, 'label', e.target.value)}
                      placeholder="e.g. Cash, Car"
                      className="flex-1 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400"
                    />
                    <input
                      type="number"
                      value={a.amount || ''}
                      onChange={e => updAsset(i, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400"
                    />
                    <button
                      onClick={() => setAssets(assets.filter((_, j) => j !== i))}
                      className="text-charcoal-600 hover:text-red-400 px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setAssets([...assets, { label: '', amount: 0 }])}
                  className="text-xs text-charcoal-400 hover:text-gold-400 self-start"
                >
                  + Add asset
                </button>
              </div>

              {/* Liabilities */}
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-red-400">Liabilities</span>
                {liabilities.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={l.label}
                      onChange={e => updLiability(i, 'label', e.target.value)}
                      placeholder="e.g. Mortgage, Car Loan"
                      className="flex-1 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400"
                    />
                    <input
                      type="number"
                      value={l.amount || ''}
                      onChange={e => updLiability(i, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400"
                    />
                    <button
                      onClick={() => setLiabilities(liabilities.filter((_, j) => j !== i))}
                      className="text-charcoal-600 hover:text-red-400 px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setLiabilities([...liabilities, { label: '', amount: 0 }])}
                  className="text-xs text-charcoal-400 hover:text-gold-400 self-start"
                >
                  + Add liability
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-charcoal-800">
              <p className="text-sm text-charcoal-400">
                Net worth preview:{' '}
                <span className={cn('font-semibold', previewNet >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {fmt(previewNet)}
                </span>
              </p>
              <Button onClick={save} loading={saving}>Save</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab container ─────────────────────────────────────────────────────────────

export function ReportsTab() {
  const [view, setView] = useState<View>('spending')

  const views: { key: View; label: string }[] = [
    { key: 'spending',        label: 'Spending by Category' },
    { key: 'income-expenses', label: 'Income vs Expenses' },
    { key: 'net-worth',       label: 'Net Worth' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 flex-wrap">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              view === v.key
                ? 'bg-gold-400 text-charcoal-950'
                : 'bg-charcoal-800 text-charcoal-400 hover:text-white'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'spending'        && <SpendingView />}
      {view === 'income-expenses' && <IncomeExpensesView />}
      {view === 'net-worth'       && <NetWorthView />}
    </div>
  )
}
