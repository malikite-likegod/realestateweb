'use client'

import { useState, useEffect, useCallback } from 'react'
import { SecurityAuditFilters, type AuditFilters } from '@/components/admin/security/SecurityAuditFilters'
import { SecurityAuditTable, type AuditRow } from '@/components/admin/security/SecurityAuditTable'

export default function SecurityAuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ events: [], actor: '', ip: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ rows: AuditRow[]; total: number }>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (f: AuditFilters, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' })
      if (f.events.length > 0) params.set('event', f.events.join(','))
      if (f.actor) params.set('actor', f.actor)
      if (f.ip)    params.set('ip', f.ip)
      if (f.from)  params.set('from', f.from)
      if (f.to)    params.set('to', f.to)

      const res = await fetch(`/api/admin/security-audit?${params}`)
      if (!res.ok) throw new Error('Failed to load audit log')
      const json = await res.json()
      setData({ rows: json.data, total: json.total })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(filters, page)
  }, [filters, page, fetchData])

  function handleFiltersChange(next: AuditFilters) {
    setFilters(next)
    setPage(1)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Security Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">Authentication events from the last 90 days</p>
      </div>

      <SecurityAuditFilters filters={filters} onChange={handleFiltersChange} />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>
      ) : (
        <SecurityAuditTable
          rows={data.rows}
          total={data.total}
          page={page}
          limit={50}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
