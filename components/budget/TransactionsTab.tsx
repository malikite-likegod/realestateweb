'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { TransactionModal, type TransactionDraft } from './TransactionModal'
import { cn } from '@/lib/utils'

type TxRow = {
  id: string; type: 'income' | 'expense'
  categoryId: string | null; categoryName: string | null
  amount: number; date: string
  payee: string | null; notes: string | null; receiptUrl: string | null
}
type Group = { id: string; name: string; categories: { id: string; name: string }[] }

function toMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function TransactionsTab() {
  const [month, setMonth]             = useState(toMonth)
  const [typeFilter, setTypeFilter]   = useState<'all' | 'income' | 'expense'>('all')
  const [payeeFilter, setPayeeFilter] = useState('')
  const [sort, setSort]               = useState('date_desc')
  const [rows, setRows]               = useState<TxRow[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [groups, setGroups]           = useState<Group[]>([])
  const [modalOpen, setModalOpen]     = useState(false)
  const [editDraft, setEditDraft]     = useState<Partial<TransactionDraft> | undefined>()
  const [modalKey, setModalKey]       = useState(0)
  const [lightbox, setLightbox]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ month, sort })
    if (typeFilter !== 'all') p.set('type', typeFilter)
    if (payeeFilter) p.set('payee', payeeFilter)

    const [txRes, gRes] = await Promise.all([
      fetch(`/api/budget/transactions?${p}`),
      fetch('/api/budget/groups'),
    ])
    const txJson = await txRes.json()
    const gJson  = await gRes.json()
    setRows(txJson.data?.items ?? [])
    setTotal(txJson.data?.total ?? 0)
    setGroups(gJson.data ?? [])
    setLoading(false)
  }, [month, typeFilter, payeeFilter, sort])

  useEffect(() => { load() }, [load])

  function openEdit(t: TxRow) {
    setEditDraft({
      id: t.id, type: t.type, categoryId: t.categoryId,
      amount: t.amount, date: t.date.split('T')[0],
      payee: t.payee ?? '', notes: t.notes ?? '', receiptUrl: t.receiptUrl,
    })
    setModalOpen(true)
  }

  function openNew() { setEditDraft(undefined); setModalKey(k => k + 1); setModalOpen(true) }

  async function deleteRow(id: string) {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/budget/transactions/${id}`, { method: 'DELETE' })
    load()
  }

  function toggleSort(key: string) {
    setSort(s => s === key + '_desc' ? key + '_asc' : key + '_desc')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-white border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-400" />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-charcoal-200">
          {(['all', 'income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-2 text-sm capitalize transition-colors',
                typeFilter === t ? 'bg-charcoal-900 text-white' : 'text-charcoal-600 hover:bg-charcoal-50')}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500">Payee</label>
          <input value={payeeFilter} onChange={e => setPayeeFilter(e.target.value)} placeholder="Search payee…"
            className="bg-white border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-400 w-44" />
        </div>
        <Button onClick={openNew} className="ml-auto" leftIcon={<Plus size={16} />}>Add Transaction</Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-charcoal-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-100">
              {[
                { label: 'Date',     sortKey: 'date' },
                { label: 'Payee',    sortKey: null },
                { label: 'Category', sortKey: null },
                { label: 'Amount',   sortKey: 'amount' },
                { label: 'Receipt',  sortKey: null },
                { label: '',         sortKey: null },
              ].map(col => (
                <th key={col.label}
                  onClick={() => col.sortKey && toggleSort(col.sortKey)}
                  className={cn('px-4 py-3 text-left text-xs text-charcoal-500 font-medium uppercase tracking-wider',
                    col.sortKey && 'cursor-pointer hover:text-charcoal-700')}
                >
                  {col.label}
                  {col.sortKey && sort.startsWith(col.sortKey) && (
                    <span className="ml-1">{sort.endsWith('desc') ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-charcoal-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-charcoal-500">No transactions found</td></tr>
            ) : rows.map(t => (
              <tr key={t.id}
                onClick={() => openEdit(t)}
                className="border-b border-charcoal-100 hover:bg-charcoal-50 cursor-pointer"
              >
                <td className="px-4 py-3 text-charcoal-900 whitespace-nowrap">{fmtDate(t.date)}</td>
                <td className="px-4 py-3 text-charcoal-900">{t.payee ?? '—'}</td>
                <td className="px-4 py-3 text-charcoal-500">{t.categoryName ?? '—'}</td>
                <td className={cn('px-4 py-3 font-medium', t.type === 'income' ? 'text-green-700' : 'text-charcoal-900')}>
                  {t.type === 'income' ? '+' : ''}{fmt(t.amount)}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  {t.receiptUrl && (
                    t.receiptUrl.toLowerCase().endsWith('.pdf')
                      ? <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="text-gold-500 hover:underline text-xs">PDF</a>
                      : <img src={t.receiptUrl} alt="receipt"
                          onClick={() => setLightbox(t.receiptUrl!)}
                          className="h-8 w-8 object-cover rounded cursor-pointer hover:opacity-80" />
                  )}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => deleteRow(t.id)}
                    className="text-charcoal-400 hover:text-red-600 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && total > 0 && (
          <div className="px-4 py-3 border-t border-charcoal-100 text-xs text-charcoal-500">
            {total} transaction{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Transaction modal */}
      <TransactionModal
        key={editDraft?.id ?? `new-${modalKey}`}
        open={modalOpen}
        initial={editDraft}
        groups={groups}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />

      {/* Receipt lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Receipt" className="max-w-2xl max-h-[90vh] object-contain rounded-xl" />
        </div>
      )}
    </div>
  )
}
