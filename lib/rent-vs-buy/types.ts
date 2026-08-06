export interface LeaseCostItem {
  id: string
  label: string
  amountMonthly: number
}

export interface RentVsBuyAssumptions {
  downPaymentPercent: number
  contractRate: number
  amortizationYears: number
}

/** A real for-sale listing (ResoProperty) matched against the user's target monthly payment. */
export interface RentVsBuyListing {
  id: string
  listingKey: string
  address: string
  neighbourhood: string | null
  city: string
  /** Straight-line distance from the searched city, in km. Null if the city couldn't be geocoded. */
  distanceKm: number | null
  price: number
  beds: number | null
  baths: number | null
  sqft: number | null
  estimatedMonthlyPayment: number
}

export interface RentVsBuySearchResponse {
  listings: RentVsBuyListing[]
  matchedCityName: string
  /** False when the searched city couldn't be geocoded — results are city-matched only, not distance-filtered. */
  distanceAvailable: boolean
}
