// GET  /api/book/[slug]?date=YYYY-MM-DD  — return available time slots for a date (public)
// POST /api/book/[slug]                  — create a booking (public)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── Helpers ───────────────────────────────────────────────────────────────────

type Window = { dayOfWeek: number; startTime: string; endTime: string }

function parseWindows(raw: string): Window[] {
  try { return JSON.parse(raw) as Window[] } catch { return [] }
}

// Build HH:MM-keyed slot list for a given calendar date.
// Returns ISO datetime strings (UTC) for start of each slot.
function buildSlots(date: string, windows: Window[], durationMin: number, bufferMin: number): Date[] {
  const d = new Date(date + 'T00:00:00') // treat as local midnight
  const dow = d.getDay()                  // 0=Sun…6=Sat

  const dayWindows = windows.filter(w => w.dayOfWeek === dow)
  if (dayWindows.length === 0) return []

  const slots: Date[] = []
  for (const w of dayWindows) {
    const [sh, sm] = w.startTime.split(':').map(Number)
    const [eh, em] = w.endTime.split(':').map(Number)

    const windowStart = new Date(d)
    windowStart.setHours(sh, sm, 0, 0)
    const windowEnd = new Date(d)
    windowEnd.setHours(eh, em, 0, 0)

    let cursor = new Date(windowStart)
    while (cursor.getTime() + durationMin * 60_000 <= windowEnd.getTime()) {
      slots.push(new Date(cursor))
      cursor = new Date(cursor.getTime() + (durationMin + bufferMin) * 60_000)
    }
  }
  return slots
}

// ── GET — available slots ─────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const schedule = await prisma.availabilitySchedule.findUnique({ where: { slug } })
  if (!schedule || !schedule.isActive) {
    return NextResponse.json({ error: 'Booking page not found' }, { status: 404 })
  }

  // Build all theoretical slots
  const windows  = parseWindows(schedule.windows)
  const allSlots = buildSlots(date, windows, schedule.meetingDurationMin, schedule.bufferMinutes)

  // Remove slots in the past
  const now = new Date()
  const futureSlots = allSlots.filter(s => s > now)

  // Remove slots that collide with existing confirmed bookings on that date
  const dayStart = new Date(date + 'T00:00:00')
  const dayEnd   = new Date(date + 'T23:59:59')

  const existingBookings = await prisma.bookingEvent.findMany({
    where: {
      scheduleId: schedule.id,
      status:     { not: 'cancelled' },
      startAt:    { gte: dayStart, lte: dayEnd },
    },
    select: { startAt: true, endAt: true },
  })

  const available = futureSlots.filter(slot => {
    const slotEnd = new Date(slot.getTime() + schedule.meetingDurationMin * 60_000)
    return !existingBookings.some(b =>
      slot < b.endAt && slotEnd > b.startAt
    )
  })

  return NextResponse.json({
    data: {
      schedule: {
        agentName:           schedule.agentName,
        agentTitle:          schedule.agentTitle,
        agentPhoto:          schedule.agentPhoto,
        meetingTitle:        schedule.meetingTitle,
        meetingDescription:  schedule.meetingDescription,
        meetingDurationMin:  schedule.meetingDurationMin,
        timezone:            schedule.timezone,
        advanceDays:         schedule.advanceDays,
      },
      slots: available.map(s => s.toISOString()),
    },
  })
}

// ── POST — create booking ─────────────────────────────────────────────────────

/** Escape HTML special characters to prevent XSS in email bodies. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendBookingEmails(opts: {
  schedule:     { agentName: string; agentEmail: string | null; meetingTitle: string; meetingDurationMin: number }
  guestName:    string
  guestEmail:   string
  startAt:      Date
  endAt:        Date
}) {
  if (!process.env.SMTP_HOST) return  // skip if SMTP not configured

  const { default: nodemailer } = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com'

  const formattedDate = opts.startAt.toLocaleString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  // Escape all user-supplied values before inserting into HTML
  const safeGuestName    = escapeHtml(opts.guestName)
  const safeGuestEmail   = escapeHtml(opts.guestEmail)
  const safeMeetingTitle = escapeHtml(opts.schedule.meetingTitle)
  const safeAgentName    = escapeHtml(opts.schedule.agentName)
  const safeDuration     = String(opts.schedule.meetingDurationMin)

  // Email to guest
  await transporter.sendMail({
    from,
    to:      opts.guestEmail,
    subject: `Your meeting with ${opts.schedule.agentName} is confirmed`,
    html: `
      <p>Hi ${safeGuestName},</p>
      <p>Your <strong>${safeMeetingTitle}</strong> with <strong>${safeAgentName}</strong> is confirmed.</p>
      <p><strong>Date &amp; Time:</strong> ${formattedDate}</p>
      <p><strong>Duration:</strong> ${safeDuration} minutes</p>
      <p>We look forward to speaking with you!</p>
    `,
  })

  // Email to agent
  if (opts.schedule.agentEmail) {
    await transporter.sendMail({
      from,
      to:      opts.schedule.agentEmail,
      subject: `New booking: ${opts.guestName} — ${formattedDate}`,
      html: `
        <p>You have a new booking!</p>
        <p><strong>Guest:</strong> ${safeGuestName} (${safeGuestEmail})</p>
        <p><strong>Meeting:</strong> ${safeMeetingTitle}</p>
        <p><strong>Date &amp; Time:</strong> ${formattedDate}</p>
        <p><strong>Duration:</strong> ${safeDuration} minutes</p>
      `,
    })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const body = await request.json()
  const { guestName, guestEmail, guestPhone, guestMessage, startAt: startAtStr } = body

  if (!guestName || !guestEmail || !startAtStr) {
    return NextResponse.json({ error: 'guestName, guestEmail, and startAt are required' }, { status: 400 })
  }

  const schedule = await prisma.availabilitySchedule.findUnique({ where: { slug } })
  if (!schedule || !schedule.isActive) {
    return NextResponse.json({ error: 'Booking page not found' }, { status: 404 })
  }

  const startAt = new Date(startAtStr)
  if (isNaN(startAt.getTime())) {
    return NextResponse.json({ error: 'Invalid startAt' }, { status: 400 })
  }
  if (startAt < new Date()) {
    return NextResponse.json({ error: 'Cannot book a slot in the past' }, { status: 400 })
  }

  const endAt = new Date(startAt.getTime() + schedule.meetingDurationMin * 60_000)

  // Check that the slot is still available (no collision)
  const collision = await prisma.bookingEvent.findFirst({
    where: {
      scheduleId: schedule.id,
      status:     { not: 'cancelled' },
      startAt:    { lt: endAt },
      endAt:      { gt: startAt },
    },
  })
  if (collision) {
    return NextResponse.json({ error: 'This slot is no longer available' }, { status: 409 })
  }

  const booking = await prisma.bookingEvent.create({
    data: {
      scheduleId:   schedule.id,
      guestName,
      guestEmail,
      guestPhone:   guestPhone   ?? null,
      guestMessage: guestMessage ?? null,
      startAt,
      endAt,
      status: 'confirmed',
    },
  })

  // Fire-and-forget email confirmations
  sendBookingEmails({
    schedule: {
      agentName:          schedule.agentName,
      agentEmail:         schedule.agentEmail,
      meetingTitle:       schedule.meetingTitle,
      meetingDurationMin: schedule.meetingDurationMin,
    },
    guestName,
    guestEmail,
    startAt,
    endAt,
  }).catch(err => console.error('[book] email error:', err))

  return NextResponse.json({ data: booking }, { status: 201 })
}
