// GET  /api/availability — return the first (or only) availability schedule
// PUT  /api/availability — upsert the schedule

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schedule = await prisma.availabilitySchedule.findFirst()
  return NextResponse.json({ data: schedule })
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    slug, agentName, agentTitle, agentEmail, agentPhone, agentPhoto,
    meetingTitle, meetingDescription, meetingDurationMin, bufferMinutes,
    advanceDays, timezone, windows, isActive,
  } = body

  if (!slug || !agentName) {
    return NextResponse.json({ error: 'slug and agentName are required' }, { status: 400 })
  }

  const existing = await prisma.availabilitySchedule.findFirst()

  const data = {
    slug,
    agentName,
    agentTitle:          agentTitle          ?? null,
    agentEmail:          agentEmail          ?? null,
    agentPhone:          agentPhone          ?? null,
    agentPhoto:          agentPhoto          ?? null,
    meetingTitle:        meetingTitle        ?? 'Book a Meeting',
    meetingDescription:  meetingDescription  ?? null,
    meetingDurationMin:  meetingDurationMin  ?? 30,
    bufferMinutes:       bufferMinutes       ?? 15,
    advanceDays:         advanceDays         ?? 30,
    timezone:            timezone            ?? 'America/Toronto',
    windows:             JSON.stringify(typeof windows === 'string' ? JSON.parse(windows) : (windows ?? [])),
    isActive:            isActive            ?? true,
  }

  let schedule
  if (existing) {
    schedule = await prisma.availabilitySchedule.update({ where: { id: existing.id }, data })
  } else {
    schedule = await prisma.availabilitySchedule.create({ data })
  }

  return NextResponse.json({ data: schedule })
}
