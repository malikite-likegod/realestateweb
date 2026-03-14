import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const stages = await prisma.stage.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json({ data: stages })
}

export async function POST(request: Request) {
  const body = await request.json()
  const count = await prisma.stage.count()
  const stage = await prisma.stage.create({
    data: { name: body.name, order: count + 1, color: body.color ?? '#6366f1' },
  })
  return NextResponse.json({ data: stage }, { status: 201 })
}
