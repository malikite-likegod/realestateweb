import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.siteSettings.findMany()
  const result: Record<string, string> = {}
  for (const s of settings) result[s.key] = s.value
  return NextResponse.json(result)
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as Record<string, string>
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        prisma.siteSettings.upsert({
          where:  { key },
          update: { value },
          create: { key, value },
        })
      )
    )
    revalidateTag('blur_mode', 'default')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
