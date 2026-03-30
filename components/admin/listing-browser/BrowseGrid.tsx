'use client'

import Link from 'next/link'
import type { ResoListing } from './types'

interface Props {
  listings:  ResoListing[]
  selected:  Set<string>
  onToggle:  (key: string) => void
}

function getFirstPhoto(media: string | null): string {
  try { return JSON.parse(media ?? '[]')[0]?.url ?? JSON.parse(media ?? '[]')[0]?.MediaURL ?? '' } catch { return '' }
}

function formatPrice(price: number | null): string {
  if (price == null) return 'Price on request'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price)
}

function formatAddress(l: ResoListing): string {
  return [l.unitNumber, l.streetNumber, l.streetName, l.streetSuffix].filter(Boolean).join(' ') || 'Address TBD'
}

export function BrowseGrid({ listings, selected, onToggle }: Props) {
  if (listings.length === 0) return <p className="p-8 text-center text-charcoal-400">No listings found.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {listings.map(l => {
        const isSelected = selected.has(l.listingKey)
        const photo = getFirstPhoto(l.media)
        return (
          <div
            key={l.listingKey}
            className={`relative rounded-lg border-2 overflow-hidden transition-all ${isSelected ? 'border-gold-500 ring-2 ring-gold-300' : 'border-charcoal-100 hover:border-charcoal-300'}`}
          >
            {/* Checkbox overlay — toggles selection */}
            <button
              type="button"
              aria-label={isSelected ? 'Deselect listing' : 'Select listing'}
              onClick={() => onToggle(l.listingKey)}
              className={`absolute top-2 right-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-gold-500 border-gold-500' : 'bg-white border-charcoal-300 hover:border-charcoal-500'}`}
            >
              {isSelected && <span className="text-white text-xs font-bold">✓</span>}
            </button>

            {/* Card body — navigates to detail */}
            <Link href={`/admin/listings/browse/${l.id}`} className="block cursor-pointer">
              {photo
                ? <img src={photo} alt="" className="w-full h-40 object-cover" />
                : <div className="w-full h-40 bg-charcoal-100 flex items-center justify-center text-charcoal-400 text-xs">No photo</div>
              }
              <div className="p-3">
                <p className="text-sm font-semibold text-charcoal-900 truncate">{formatAddress(l)}</p>
                <p className="text-xs text-charcoal-500">{l.city ?? ''}</p>
                <p className="text-base font-bold text-gold-600 mt-1">{formatPrice(l.listPrice)}</p>
                <p className="text-xs text-charcoal-400">{l.bedroomsTotal ?? '—'} bd · {l.bathroomsTotalInteger ?? '—'} ba</p>
                {isSelected && <p className="mt-2 text-xs font-semibold text-gold-600">Selected</p>}
              </div>
            </Link>
          </div>
        )
      })}
    </div>
  )
}
