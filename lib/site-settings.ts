import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

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
