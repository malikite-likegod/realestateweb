'use client'

import { useState, useEffect, useCallback } from 'react'
import { SecurityAuditFilters, type AuditFilters } from '@/components/admin/security/SecurityAuditFilters'
import { SecurityAuditTable, type AuditRow } from '@/components/admin/security/SecurityAuditTable'
import { BlockedIpsTab } from '@/components/admin/security/BlockedIpsTab'

type Tab = 'audit' | 'blocked-ips'

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState<Tab>('audit')

  // Audit log state
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
    if (activeTab === 'audit') {
      void fetchData(filters, page)
    }
  }, [filters, page, fetchData, activeTab])

  function handleFiltersChange(next: AuditFilters) {
    setFilters(next)
    setPage(1)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'audit',       label: 'Audit Log'   },
    { id: 'blocked-ips', label: 'Blocked IPs' },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Security</h1>
        <p className="mt-1 text-sm text-gray-500">Authentication events and IP block management</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'audit' && (
        <>
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
        </>
      )}

      {activeTab === 'blocked-ips' && <BlockedIpsTab />}
    </div>
  )
}
