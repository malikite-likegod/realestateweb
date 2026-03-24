'use client'

import { useState, Fragment } from 'react'
import Link from 'next/link'

export interface AuditRow {
  id: string
  createdAt: string
  event: string
  actor: string | null
  userId: string | null
  userName: string | null
  contactId: string | null
  contactName: string | null
  ip: string | null
  userAgent: string | null
  meta: Record<string, unknown> | null
}

interface Props {
  rows: AuditRow[]
  total: number
  page: number
  limit: number
  onPageChange: (page: number) => void
}

const EVENT_BADGE: Record<string, string> = {
  login_success:           'bg-green-100 text-green-800',
  '2fa_success':           'bg-green-100 text-green-800',
  portal_login_success:    'bg-green-100 text-green-800',
  '2fa_sent':              'bg-gray-100 text-gray-700',
  logout:                  'bg-gray-100 text-gray-700',
  portal_logout:           'bg-gray-100 text-gray-700',
  password_reset_request:  'bg-gray-100 text-gray-700',
  password_reset_complete: 'bg-gray-100 text-gray-700',
  password_change:         'bg-gray-100 text-gray-700',
}

function badgeClass(event: string): string {
  if (event.includes('failure')) return 'bg-red-100 text-red-800'
  return EVENT_BADGE[event] ?? 'bg-gray-100 text-gray-700'
}

function formatEvent(event: string): string {
  return event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function SecurityAuditTable({ rows, total, page, limit, onPageChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const totalPages = Math.ceil(total / limit)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Event</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Subject</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">IP Address</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">User-Agent</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No audit events found
                </td>
              </tr>
            )}
            {rows.map(row => (
              <Fragment key={row.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass(row.event)}`}>
                      {formatEvent(row.event)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{row.actor ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.contactId && row.contactName ? (
                      <Link href={`/admin/contacts/${row.contactId}`} className="text-blue-600 hover:underline">
                        {row.contactName}
                      </Link>
                    ) : row.userName ? (
                      <span className="text-gray-700">{row.userName}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.ip ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate" title={row.userAgent ?? ''}>
                    {row.userAgent ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.meta && (
                      <button
                        onClick={() => toggleExpand(row.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {expanded.has(row.id) ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded.has(row.id) && row.meta && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-4 py-2">
                      <pre className="text-xs text-gray-600 bg-white border border-gray-200 rounded p-2 overflow-x-auto">
                        {JSON.stringify(row.meta, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Page {page} of {totalPages} ({total.toLocaleString()} total)</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
