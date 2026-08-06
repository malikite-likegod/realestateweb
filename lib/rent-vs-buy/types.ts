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

export interface MockListing {
  id: string
  address: string
  neighbourhood: string
  city: string
  distanceKm: number
  price: number
  beds: number
  baths: number
  sqft: number
}

export interface ListingWithEstimate extends MockListing {
  estimatedMonthlyPayment: number
}

export interface ListingSearchParams {
  city: string
  maxDistanceKm: number
  targetMonthlyPayment: number
  toleranceDollars: number
  assumptions: RentVsBuyAssumptions
}

export interface ListingSearchResult {
  listings: ListingWithEstimate[]
  matchedCityName: string
  /** False when the entered city isn't in our benchmark table — estimates fall back to a generic regional price. */
  cityRecognized: boolean
}
