import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { searchRentVsBuyListings } from '@/services/rent-vs-buy/search'
import { DEFAULT_MAX_DISTANCE_KM, PAYMENT_MATCH_TOLERANCE_DOLLARS } from '@/lib/rent-vs-buy'
import { getRentVsBuySignupPromptSettings } from '@/lib/site-settings'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const city = searchParams.get('city') ?? ''
  const maxDistanceKmParam = Number(searchParams.get('maxDistanceKm'))
  const targetMonthlyPaymentParam = Number(searchParams.get('targetMonthlyPayment'))
  const targetMonthlyPayment = Number.isFinite(targetMonthlyPaymentParam) ? targetMonthlyPaymentParam : 0

  const result = await searchRentVsBuyListings({
    city,
    maxDistanceKm: Number.isFinite(maxDistanceKmParam) && maxDistanceKmParam > 0 ? maxDistanceKmParam : DEFAULT_MAX_DISTANCE_KM,
    targetMonthlyPayment,
    toleranceDollars: PAYMENT_MATCH_TOLERANCE_DOLLARS,
  })

  // Track tool usage per session to drive the signup-prompt nudge — only counts real
  // searches, matching the same guard searchRentVsBuyListings uses internally.
  // Non-critical: never let a tracking failure break the actual search response
  // (mirrors the PropertySearchLog handling in services/search/engine.ts).
  let promptSignup = false
  if (city.trim() && targetMonthlyPayment > 0) {
    try {
      const sessionId = (await cookies()).get('re_session')?.value
      if (sessionId) {
        await prisma.toolUsageEvent.create({ data: { sessionId, tool: 'rent_vs_buy' } })
        const [{ enabled, uses }, count] = await Promise.all([
          getRentVsBuySignupPromptSettings(),
          prisma.toolUsageEvent.count({ where: { sessionId, tool: 'rent_vs_buy' } }),
        ])
        promptSignup = enabled && count >= uses
      }
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ ...result, promptSignup })
}
