import { Spinner } from '@/components/ui'
import { ListingCard } from './ListingCard'
import type { RentVsBuySearchResponse } from '@/lib/rent-vs-buy'

interface ListingResultsGridProps {
  searchResult: RentVsBuySearchResponse | null
  loading: boolean
  error: boolean
}

export function ListingResultsGrid({ searchResult, loading, error }: ListingResultsGridProps) {
  if (loading && !searchResult) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-charcoal-200 p-8 text-sm text-charcoal-500">
        <Spinner size={16} /> Searching nearby listings…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-200 p-8 text-center text-sm text-charcoal-500">
        Something went wrong searching for listings. Try again in a moment.
      </div>
    )
  }

  if (!searchResult) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-200 p-8 text-center text-sm text-charcoal-500">
        Enter your monthly rent and city above to see nearby homes at a similar monthly cost.
      </div>
    )
  }

  if (searchResult.listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-200 p-8 text-center text-sm text-charcoal-500">
        No matching homes found right now. Try widening your maximum distance, or check back as new listings come on the market.
      </div>
    )
  }

  return (
    <div>
      {!searchResult.distanceAvailable && (
        <p className="mb-3 text-xs text-charcoal-500">
          We couldn&apos;t pinpoint &quot;{searchResult.matchedCityName}&quot; on the map, so these are matched by
          city name only — distance isn&apos;t shown.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {searchResult.listings.map(listing => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  )
}
