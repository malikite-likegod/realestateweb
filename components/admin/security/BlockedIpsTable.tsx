'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'

interface BlockedIpRow {
  id:        string
  ip:        string
  blockedAt: string
  expiresAt: string
}

interface Props {
  refreshKey: number
}

export function BlockedIpsTable({ refreshKey }: Props) {
  const [rows, setRows]         = useState<BlockedIpRow[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const limit = 50

  const fetchRows = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/blocked-ips?page=${p}&limit=${limit}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setRows(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError('Failed to load blocked IPs. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRows(page)
  }, [page, fetchRows, refreshKey])

  async function handleRemove(id: string, ip: string) {
    if (!window.confirm(`Remove block for ${ip}?`)) return
    setRemoving(id)
    try {
      const res = await fetch(`/api/admin/blocked-ips/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      if (rows.length === 1 && page > 1) {
        setPage(p => p - 1)
      } else {
        void fetchRows(page)
      }
    } catch {
      setError('Failed to remove IP. Please try again.')
    } finally {
      setRemoving(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Currently Blocked IPs</h2>
        {total > 0 && <span className="text-sm text-gray-500">{total} active</span>}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No IPs are currently blocked.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {['IP Address', 'Blocked', 'Expires', ''].map(h => (
                    <th key={h} className="px-3 py-2 font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-900">{row.ip}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {row.blockedAt ? new Date(row.blockedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        disabled={removing === row.id}
                        onClick={() => handleRemove(row.id, row.ip)}
                        title="Remove block"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <button
                className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
