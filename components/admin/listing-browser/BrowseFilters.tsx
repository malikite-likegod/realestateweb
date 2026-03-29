'use client'
import { Input, Button } from '@/components/ui'

export interface BrowseFilterValues {
  city:         string
  propertyType: string
  minPrice:     string
  maxPrice:     string
  minBeds:      string
}

interface Props {
  filters:   BrowseFilterValues
  onChange:  (f: BrowseFilterValues) => void
  onSearch:  () => void
}

export function BrowseFilters({ filters, onChange, onSearch }: Props) {
  const set = (key: keyof BrowseFilterValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...filters, [key]: e.target.value })

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 bg-white border-b border-charcoal-100">
      <Input label="City"      value={filters.city}     onChange={set('city')}     className="w-36" />
      <Input label="Min Price" value={filters.minPrice} onChange={set('minPrice')} className="w-28" type="number" />
      <Input label="Max Price" value={filters.maxPrice} onChange={set('maxPrice')} className="w-28" type="number" />
      <Input label="Min Beds"  value={filters.minBeds}  onChange={set('minBeds')}  className="w-20" type="number" />
      <Button variant="primary" onClick={onSearch} className="self-end">Search</Button>
    </div>
  )
}
