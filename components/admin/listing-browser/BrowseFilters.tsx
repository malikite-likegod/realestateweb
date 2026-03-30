'use client'
import { useState, useEffect } from 'react'
import { SlidersHorizontal, X, Building2 } from 'lucide-react'
import { Button, Input, AutocompleteInput } from '@/components/ui'

export interface BrowseFilterValues {
  area:         string
  propertyType: string
  listingType:  string
  minPrice:     string
  maxPrice:     string
  minBeds:      string
  minBaths:     string
  minGarage:    string
  minSqft:      string
  maxSqft:      string
}

export const EMPTY_FILTERS: BrowseFilterValues = {
  area: '', propertyType: '', listingType: '',
  minPrice: '', maxPrice: '', minBeds: '', minBaths: '',
  minGarage: '', minSqft: '', maxSqft: '',
}

const PROPERTY_TYPES = ['Detached', 'Semi-Detached', 'Condo Apt', 'Condo Townhouse', 'Townhouse', 'Link', 'Duplex', 'Commercial']
const LISTING_TYPES  = [
  { value: '',      label: 'Sale or Lease' },
  { value: 'sale',  label: 'For Sale' },
  { value: 'lease', label: 'For Lease' },
]

const selectClass =
  'rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-charcoal-900 focus:border-transparent transition-colors'

interface Props {
  filters:          BrowseFilterValues
  onChange:         (f: BrowseFilterValues) => void
  onSearch:         () => void
  officeOnly:       boolean
  onOfficeOnlyChange: (v: boolean) => void
}

export function BrowseFilters({ filters, onChange, onSearch, officeOnly, onOfficeOnlyChange }: Props) {
  const [showMore,    setShowMore]    = useState(false)
  const [areaOptions, setAreaOptions] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/search/geo?level=areas')
      .then(r => r.ok ? r.json() : [])
      .then((data: string[]) => setAreaOptions(data))
      .catch(() => {})
  }, [])

  const set = (key: keyof BrowseFilterValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...filters, [key]: e.target.value })

  const hasFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="p-4 bg-white border-b border-charcoal-100 space-y-3">
      {/* Primary row */}
      <div className="flex flex-wrap gap-3 items-end">

        {/* My Office toggle */}
        <button
          type="button"
          onClick={() => onOfficeOnlyChange(!officeOnly)}
          className={`self-end flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            officeOnly
              ? 'border-gold-500 bg-gold-50 text-gold-700'
              : 'border-charcoal-200 text-charcoal-500 hover:border-charcoal-400'
          }`}
        >
          <Building2 size={14} />
          My Office
        </button>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Area / City</label>
          <AutocompleteInput
            options={areaOptions}
            value={filters.area}
            onChange={v => onChange({ ...filters, area: v })}
            placeholder="e.g. Toronto"
            className="w-48"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Property Type</label>
          <select value={filters.propertyType} onChange={set('propertyType')} className={`${selectClass} w-44`}>
            <option value="">All Types</option>
            {PROPERTY_TYPES.map(pt => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Listing Type</label>
          <select value={filters.listingType} onChange={set('listingType')} className={`${selectClass} w-36`}>
            {LISTING_TYPES.map(lt => (
              <option key={lt.value} value={lt.value}>{lt.label}</option>
            ))}
          </select>
        </div>

        <Input label="Min Price" value={filters.minPrice} onChange={set('minPrice')} className="w-28" type="number" />
        <Input label="Max Price" value={filters.maxPrice} onChange={set('maxPrice')} className="w-28" type="number" />

        <Button variant="primary" onClick={onSearch} className="self-end">Search</Button>

        <button
          type="button"
          onClick={() => setShowMore(v => !v)}
          className={`self-end flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            showMore
              ? 'border-charcoal-900 bg-charcoal-900 text-white'
              : 'border-charcoal-200 text-charcoal-600 hover:border-charcoal-400'
          }`}
        >
          <SlidersHorizontal size={14} />
          More filters
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="self-end flex items-center gap-1 px-3 py-2.5 rounded-lg border border-charcoal-200 text-sm text-charcoal-500 hover:text-charcoal-900 hover:border-charcoal-400 transition-colors"
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {/* More filters row */}
      {showMore && (
        <div className="flex flex-wrap gap-3 items-end pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Min Beds</label>
            <select value={filters.minBeds} onChange={set('minBeds')} className={`${selectClass} w-28`}>
              <option value="">Any</option>
              {['1','2','3','4','5+'].map(v => (
                <option key={v} value={v === '5+' ? '5' : v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Min Baths</label>
            <select value={filters.minBaths} onChange={set('minBaths')} className={`${selectClass} w-28`}>
              <option value="">Any</option>
              {['1','2','3','4+'].map(v => (
                <option key={v} value={v === '4+' ? '4' : v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Garage</label>
            <select value={filters.minGarage} onChange={set('minGarage')} className={`${selectClass} w-28`}>
              <option value="">Any</option>
              {['1','2','3+'].map(v => (
                <option key={v} value={v === '3+' ? '3' : v}>{v}</option>
              ))}
            </select>
          </div>

          <Input label="Min Sqft" value={filters.minSqft} onChange={set('minSqft')} className="w-28" type="number" />
          <Input label="Max Sqft" value={filters.maxSqft} onChange={set('maxSqft')} className="w-28" type="number" />
        </div>
      )}
    </div>
  )
}
