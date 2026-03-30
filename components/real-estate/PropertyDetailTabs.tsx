'use client'

/**
 * PropertyDetailTabs
 *
 * Tabbed "Full Property Details" section for listing detail pages.
 * Mirrors the layout shown in RESO-standard listing portals:
 * Interior · Exterior · Building · Community · Taxes & Fees
 */

import { useState } from 'react'

export type DetailRow = { label: string; value: string | number }

interface Props {
  interior:  DetailRow[]
  exterior:  DetailRow[]
  building:  DetailRow[]
  community: DetailRow[]
  taxes:     DetailRow[]
}

const TABS = ['Interior', 'Exterior', 'Building', 'Community', 'Taxes & Fees'] as const
type Tab = typeof TABS[number]

export function PropertyDetailTabs({ interior, exterior, building, community, taxes }: Props) {
  const [active, setActive] = useState<Tab>('Interior')

  const data: Record<Tab, DetailRow[]> = {
    'Interior':     interior,
    'Exterior':     exterior,
    'Building':     building,
    'Community':    community,
    'Taxes & Fees': taxes,
  }

  const rows = data[active]

  // Hide the whole section if every tab is empty
  const hasAny = interior.length + exterior.length + building.length + community.length + taxes.length > 0
  if (!hasAny) return null

  return (
    <div className="rounded-xl border border-charcoal-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-charcoal-100 bg-charcoal-50">
        <h2 className="text-sm font-semibold text-charcoal-900 uppercase tracking-wide">Full Property Details</h2>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-charcoal-100 bg-white">
        {TABS.map(tab => {
          const count = data[tab].length
          if (count === 0) return null
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active === tab
                  ? 'border-charcoal-900 text-charcoal-900'
                  : 'border-transparent text-charcoal-500 hover:text-charcoal-700 hover:border-charcoal-300'
              }`}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="bg-white px-5 py-4">
        {rows.length > 0 ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex justify-between items-baseline py-2.5 border-b border-charcoal-50 gap-4">
                <dt className="text-sm text-charcoal-500 shrink-0">{label}</dt>
                <dd className="text-sm font-medium text-charcoal-900 text-right">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-charcoal-400 py-4 italic">No details available for this section.</p>
        )}
      </div>
    </div>
  )
}
