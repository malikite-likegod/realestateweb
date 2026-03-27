import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, extractIp } from '@/lib/audit'
import { parseCsv } from '@/lib/csv'
import { isValidIpv4, normalizeIpv4 } from '@/lib/ip-utils'

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

// GET /api/admin/blocked-ips
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page    = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10) || 1)
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
  const includeExpired = searchParams.get('includeExpired') === 'true'

  const where = includeExpired ? {} : { expiresAt: { gt: new Date() } }

  const [total, data] = await Promise.all([
    prisma.blockedIp.count({ where }),
    prisma.blockedIp.findMany({
      where,
      orderBy: { blockedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ data, total })
}

// POST /api/admin/blocked-ips  (body: { csv: string })
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Body size guard — read actual body text, not the content-length header (which can be absent)
  let bodyText: string
  try {
    bodyText = await request.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
  }
  if (Buffer.byteLength(bodyText, 'utf8') > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Request body too large. Maximum is 5 MB.' }, { status: 413 })
  }

  let body: { csv?: string }
  try {
    body = JSON.parse(bodyText)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.csv !== 'string' || !body.csv.trim()) {
    return NextResponse.json({ error: 'csv field is required' }, { status: 400 })
  }

  // Parse CSV — use existing parseCsv utility which lowercases header keys
  let rawRows: Record<string, string>[]
  try {
    rawRows = parseCsv(body.csv)
  } catch {
    return NextResponse.json({ error: 'Could not parse CSV' }, { status: 400 })
  }

  if (rawRows.length > 10_000) {
    return NextResponse.json(
      { error: 'Too many IPs. Maximum is 10,000 per upload.' },
      { status: 422 }
    )
  }

  if (rawRows.length > 0 && !rawRows.some(r => 'ip' in r)) {
    return NextResponse.json(
      { error: 'CSV must contain an "ip" column header.' },
      { status: 422 }
    )
  }

  const now       = new Date()
  const expiresAt = addMonths(now, 4)

  let skipped = 0
  const invalid: string[] = []
  const validIps: string[] = []

  // Validate and normalize all rows first
  for (const row of rawRows) {
    const raw = (row['ip'] ?? '').trim()
    if (!raw) { skipped++; continue }

    if (!isValidIpv4(raw)) {
      if (invalid.length < 50) invalid.push(raw)
      skipped++
      continue
    }
    validIps.push(normalizeIpv4(raw))
  }

  // Deduplicate within the upload itself
  const uniqueIps = [...new Set(validIps)]

  // One query to find which IPs already exist
  const existing = await prisma.blockedIp.findMany({
    where: { ip: { in: uniqueIps } },
    select: { ip: true },
  })
  const existingSet = new Set(existing.map(r => r.ip))

  const toCreate = uniqueIps.filter(ip => !existingSet.has(ip))
  const toUpdate = uniqueIps.filter(ip =>  existingSet.has(ip))

  await prisma.$transaction(async (tx) => {
    // Batch create new IPs
    await tx.blockedIp.createMany({
      data: toCreate.map(ip => ({ ip, blockedAt: now, expiresAt })),
      skipDuplicates: true,
    })

    // Batch update existing IPs in parallel (max 100 concurrent)
    const BATCH = 100
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH)
      await Promise.all(batch.map(ip =>
        tx.blockedIp.update({ where: { ip }, data: { expiresAt } })
      ))
    }
  })

  const added   = toCreate.length
  const updated = toUpdate.length

  await logAuditEvent({
    event:     'ip_blocklist_upload',
    userId:    session.id,
    ip:        extractIp(request),
    meta:      { added, updated, skipped, invalidCount: invalid.length },
  })

  return NextResponse.json({ added, updated, skipped, invalid })
}
