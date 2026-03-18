import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { signJwt, verifyJwt } from './jwt'
import { prisma } from './prisma'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string): Promise<string> {
  const token = await signJwt({ sub: userId })
  return token
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null

  try {
    const payload = await verifyJwt(token)
    if (!payload?.sub) return null

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, passwordChangedAt: true },
    })
    if (!user) return null

    // Invalidate tokens issued before the last password change
    if (user.passwordChangedAt && typeof payload.iat === 'number') {
      if (payload.iat < user.passwordChangedAt.getTime() / 1000) {
        return null
      }
    }

    return user
  } catch {
    return null
  }
}

export async function requireSession() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export async function validateApiKey(key: string) {
  // We store a hash; compare prefix first for performance
  const prefix = key.slice(0, 8)
  const apiKey = await prisma.apiKey.findFirst({
    where: { prefix },
    include: { user: { select: { id: true, role: true } } },
  })
  if (!apiKey) return null
  const valid = await bcrypt.compare(key, apiKey.keyHash)
  if (!valid) return null

  // update lastUsedAt
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
  return apiKey.user
}
