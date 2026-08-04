import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { DEFAULT_ASSUMPTIONS } from '@/lib/mortgage'

export const getBlurModeEnabled = unstable_cache(
  async () => {
    const row = await prisma.siteSettings.findUnique({ where: { key: 'blur_mode_enabled' } })
    return (row?.value ?? 'false') === 'true'
  },
  ['blur-mode-enabled'],
  { revalidate: 60, tags: ['blur_mode'] }
)

export const getGateSettings = unstable_cache(
  async () => {
    const rows = await prisma.siteSettings.findMany({
      where: { key: { in: ['listing_gate_limit', 'listing_gate_enabled'] } },
    })
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return {
      limit:   parseInt(map['listing_gate_limit']   ?? '3', 10),
      enabled: (map['listing_gate_enabled'] ?? 'true') === 'true',
    }
  },
  ['gate-settings'],
  { revalidate: 60 }
)

export const getMlsSyncInterval = unstable_cache(
  async () => {
    const row = await prisma.siteSettings.findUnique({ where: { key: 'mls_sync_interval_minutes' } })
    return parseInt(row?.value ?? '60', 10)
  },
  ['mls-sync-interval'],
  { revalidate: 60 }
)

/** Returns the admin-set "today's rate" for the mortgage calculator, as a decimal (e.g. 0.0499). */
export const getMortgageRate = unstable_cache(
  async () => {
    const row = await prisma.siteSettings.findUnique({ where: { key: 'mortgage_current_rate_percent' } })
    const percent = row ? parseFloat(row.value) : NaN
    return Number.isFinite(percent) && percent > 0 ? percent / 100 : DEFAULT_ASSUMPTIONS.contractRate
  },
  ['mortgage-current-rate'],
  { revalidate: 300, tags: ['mortgage_rate'] }
)

export const getBrokerageFilter = unstable_cache(
  async () => {
    const rows = await prisma.siteSettings.findMany({
      where: { key: { in: ['brokerage_office_key', 'brokerage_name'] } },
    })
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return {
      officeKey:  map['brokerage_office_key'] ?? process.env.AMPRE_OFFICE_KEY      ?? null,
      officeName: map['brokerage_name']        ?? process.env.AMPRE_BROKERAGE_NAME  ?? null,
    }
  },
  ['brokerage-filter'],
  { revalidate: 300 }
)
