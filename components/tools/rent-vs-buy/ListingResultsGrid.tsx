import { ListingCard } from './ListingCard'
import type { ListingSearchResult } from '@/lib/rent-vs-buy'

interface ListingResultsGridProps {
  searchResult: ListingSearchResult | null
}

export function ListingResultsGrid({ searchResult }: ListingResultsGridProps) {
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
        No matching homes found. Try widening your maximum distance.
      </div>
    )
  }

  return (
    <div>
      {!searchResult.cityRecognized && (
        <p className="mb-3 text-xs text-charcoal-500">
          We don&apos;t have detailed local pricing for &quot;{searchResult.matchedCityName}&quot; yet, so these
          estimates use average regional pricing.
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
