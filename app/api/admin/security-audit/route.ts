import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AUDIT_EVENTS } from '@/lib/audit'

const PRUNE_KEY = 'security_audit_last_pruned'
const PRUNE_DAYS = 90
const PRUNE_THROTTLE_MS = 60 * 60 * 1000 // 1 hour

async function maybePrune(): Promise<void> {
  try {
    const setting = await prisma.siteSettings.findUnique({ where: { key: PRUNE_KEY } })
    if (setting) {
      const lastPruned = new Date(setting.value)
      if (!isNaN(lastPruned.getTime()) && Date.now() - lastPruned.getTime() < PRUNE_THROTTLE_MS) {
        return // Pruned recently — skip
      }
    }
    // Row absent or stale — run prune
    const cutoff = new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000)
    await prisma.securityAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    await prisma.siteSettings.upsert({
      where:  { key: PRUNE_KEY },
      update: { value: new Date().toISOString() },
      create: { key: PRUNE_KEY, value: new Date().toISOString() },
    })
  } catch (err) {
    console.error('[security-audit] Prune failed:', err)
    // Do not rethrow — query proceeds regardless; timestamp not upserted so next request retries
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function parseDate(value: string, endOfDay = false): Date | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const d = new Date(dateOnly ? (endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`) : value)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)

  const page  = clamp(parseInt(searchParams.get('page')  ?? '1',  10) || 1,  1, Infinity)
  const limit = clamp(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1, 100)

  const fromParam = searchParams.get('from')
  const toParam   = searchParams.get('to')

  if (fromParam) {
    const d = parseDate(fromParam, false)
    if (!d) return NextResponse.json({ error: 'Invalid "from" date' }, { status: 400 })
  }
  if (toParam) {
    const d = parseDate(toParam, true)
    if (!d) return NextResponse.json({ error: 'Invalid "to" date' }, { status: 400 })
  }

  const from = fromParam ? parseDate(fromParam, false) : null
  const to   = toParam   ? parseDate(toParam,   true)  : null

  // Event filter — whitelist only, trim whitespace
  const eventParam  = searchParams.get('event')
  const validEvents = eventParam
    ? eventParam
        .split(',')
        .map(e => e.trim())
        .filter((e): e is typeof AUDIT_EVENTS[number] =>
          (AUDIT_EVENTS as readonly string[]).includes(e)
        )
    : []

  const actorParam = searchParams.get('actor') ?? undefined
  const ipParam    = searchParams.get('ip')    ?? undefined

  await maybePrune()

  const where = {
    ...(validEvents.length > 0 ? { event: { in: validEvents } } : {}),
    ...(actorParam ? { actor: { contains: actorParam } } : {}),
    ...(ipParam    ? { ip: ipParam } : {}),
    ...((from || to) ? {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to   ? { lte: to   } : {}),
      },
    } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.securityAuditLog.count({ where }),
    prisma.securityAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user:    { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  const data = rows.map(row => ({
    id:          row.id,
    createdAt:   row.createdAt,
    event:       row.event,
    actor:       row.actor,
    userId:      row.userId,
    userName:    row.user?.name ?? null,
    contactId:   row.contactId,
    contactName: row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : null,
    ip:          row.ip,
    userAgent:   row.userAgent,
    meta: (() => {
      try { return row.meta ? JSON.parse(row.meta) : null }
      catch { return null }
    })(),
  }))

  return NextResponse.json({ total, page, limit, data })
}
