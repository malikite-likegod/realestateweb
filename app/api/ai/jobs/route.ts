import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { enqueueJob, processJob } from '@/services/ai/jobs'
import { getSession } from '@/lib/auth'

const jobSchema = z.object({
  type:  z.enum(['lead_scoring', 'blog_generation', 'listing_description', 'market_analysis', 'buyer_intent']),
  input: z.record(z.unknown()),
  runNow: z.boolean().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page   = parseInt(searchParams.get('page') ?? '1')

  const jobs = await prisma.aiJob.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * 20,
    take: 20,
    include: { result: true },
  })

  return NextResponse.json({ data: jobs })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { type, input, runNow } = jobSchema.parse(body)

    const jobId = await enqueueJob(type, input, session.id)

    if (runNow) {
      // Process inline (for small jobs)
      await processJob(jobId)
    }

    const job = await prisma.aiJob.findUnique({ where: { id: jobId }, include: { result: true } })
    return NextResponse.json({ data: job }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
