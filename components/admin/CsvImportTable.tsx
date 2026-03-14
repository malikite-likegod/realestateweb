'use client'

import { cn } from '@/lib/utils'
import type { ParsedContactRow } from '@/types/csv'

interface CsvImportTableProps {
  rows: ParsedContactRow[]
}

export function CsvImportTable({ rows }: CsvImportTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-charcoal-500 py-4 text-center">
        No data rows found in this CSV.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-charcoal-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-charcoal-50 text-left">
            {['#', 'Name', 'Email', 'Phone', 'Company', 'Status', 'Tags', 'Result'].map(h => (
              <th key={h} className="px-3 py-2 font-medium text-charcoal-700 border-b border-charcoal-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.rowIndex}
              className={cn(
                row.rowStatus === 'ready' ? 'bg-green-50' : 'bg-red-50'
              )}
            >
              <td className="px-3 py-2 text-charcoal-400">{row.rowIndex}</td>
              <td className="px-3 py-2 text-charcoal-900">
                {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="px-3 py-2 text-charcoal-700">{row.email || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.phone || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.company || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.status || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.tags || '—'}</td>
              <td className="px-3 py-2">
                {row.rowStatus === 'ready' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                    ✓ Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 rounded-full px-2 py-0.5">
                    ✗ {row.errorMessage}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
