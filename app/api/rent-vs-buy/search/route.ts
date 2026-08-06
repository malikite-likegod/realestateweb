import { NextResponse } from 'next/server'
import { searchRentVsBuyListings } from '@/services/rent-vs-buy/search'
import { DEFAULT_MAX_DISTANCE_KM, PAYMENT_MATCH_TOLERANCE_DOLLARS } from '@/lib/rent-vs-buy'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const city = searchParams.get('city') ?? ''
  const maxDistanceKmParam = Number(searchParams.get('maxDistanceKm'))
  const targetMonthlyPaymentParam = Number(searchParams.get('targetMonthlyPayment'))

  const result = await searchRentVsBuyListings({
    city,
    maxDistanceKm: Number.isFinite(maxDistanceKmParam) && maxDistanceKmParam > 0 ? maxDistanceKmParam : DEFAULT_MAX_DISTANCE_KM,
    targetMonthlyPayment: Number.isFinite(targetMonthlyPaymentParam) ? targetMonthlyPaymentParam : 0,
    toleranceDollars: PAYMENT_MATCH_TOLERANCE_DOLLARS,
  })

  return NextResponse.json(result)
}
