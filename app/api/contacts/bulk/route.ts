import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['lead', 'prospect', 'client', 'past_client'] as const

const contactRowSchema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string(),
  phone:     z.string().optional(),
  company:   z.string().optional(),
  jobTitle:  z.string().optional(),
  source:    z.string().optional(),
  status:    z.string().optional(),
  tags:      z.array(z.string()).optional(),
  birthday:  z.string().optional(),
  rowIndex:  z.number(),
})

const bulkImportSchema = z.object({
  contacts: z.array(contactRowSchema),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Row count guard — check raw body before full Zod parse to reject oversized payloads fast
    if (Array.isArray(body?.contacts) && body.contacts.length > 2000) {
      return NextResponse.json(
        { error: 'Too many rows. Maximum is 2000.' },
        { status: 400 }
      )
    }

    // Outer shape validation
    const parsed = bulkImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { contacts } = parsed.data

    let imported = 0
    let skipped  = 0
    let failed   = 0
    const errors: Array<{ row: number; email: string; reason: string }> = []

    const emailValidator = z.string().email()

    for (const row of contacts) {
      const emailResult = emailValidator.safeParse(row.email)
      if (!emailResult.success) {
        failed++
        errors.push({ row: row.rowIndex, email: row.email, reason: 'Invalid email format' })
        continue
      }

      // Check for duplicate
      const existing = await prisma.contact.findUnique({ where: { email: row.email } })
      if (existing) {
        skipped++
        continue
      }

      // Defaults
      const firstName = row.firstName
      const lastName  = row.lastName
      const status    = VALID_STATUSES.includes(row.status as typeof VALID_STATUSES[number])
        ? row.status
        : 'lead'
      const tagNames = row.tags ?? []

      try {
        // Note: Contact.email is String? (nullable) in the Prisma schema.
        // Prisma accepts string where string | null | undefined is expected,
        // so row.email (already validated as a non-empty string) is passed directly.
        await prisma.contact.create({
          data: {
            firstName,
            lastName,
            email:    row.email,
            phone:    row.phone    || null,
            company:  row.company  || null,
            jobTitle: row.jobTitle || null,
            source:   row.source   || null,
            birthday: row.birthday ? new Date(row.birthday) : null,
            status,
            tags: {
              create: tagNames.map(name => ({
                tag: {
                  connectOrCreate: {
                    where:  { name },
                    create: { name, color: '#6366f1' },
                  },
                },
              })),
            },
          },
        })
        imported++
      } catch (err) {
        failed++
        errors.push({ row: row.rowIndex, email: row.email, reason: 'Database error' })
        console.error('[bulk import row error]', err)
      }
    }

    return NextResponse.json({ imported, skipped, failed, errors })
  } catch (err) {
    console.error('[POST /api/contacts/bulk]', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
