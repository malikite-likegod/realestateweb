import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiKey } from '@/lib/auth'
import { dispatchCommand } from '@/services/ai/commands'

const commandSchema = z.object({
  command: z.enum(['create_task', 'log_activity', 'update_lead_score', 'create_contact', 'create_note', 'generate_listing_description']),
  data: z.record(z.unknown()),
})

export async function POST(request: Request) {
  // API key auth
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const apiKey = authHeader.slice(7)
  const user = await validateApiKey(apiKey)
  if (!user) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  try {
    const body = await request.json()
    const payload = commandSchema.parse(body)

    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined
    const result = await dispatchCommand(payload, undefined, ipAddress ?? undefined)

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
