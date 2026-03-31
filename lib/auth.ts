import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { signJwt, verifyJwt, verifyContactJwt, verifyPendingContactJwt } from './jwt'
import { prisma } from './prisma'

/**
 * True when cookies should be sent over HTTPS only.
 * Centralised here so every cookie setter uses the same logic and a
 * mis-named NODE_ENV value (e.g. "prod", "docker") can be handled by
 * also setting FORCE_SECURE_COOKIES=true in that environment's .env.
 */
export const isSecureContext =
  process.env.NODE_ENV === 'production' ||
  process.env.FORCE_SECURE_COOKIES === 'true'

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

export async function validateApiKey(authHeader: string | null, _request: NextRequest) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const key = authHeader.slice(7)
  const prefix = key.slice(0, 8)
  const apiKey = await prisma.apiKey.findFirst({
    where: { prefix },
    include: { user: { select: { id: true, role: true } } },
  })
  if (!apiKey) return null
  const valid = await bcrypt.compare(key, apiKey.keyHash)
  if (!valid) return null
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
  return apiKey
}

export async function getContactSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('contact_token')?.value
  if (!token) return null

  try {
    const payload = await verifyContactJwt(token)
    if (!payload) return null

    const contact = await prisma.contact.findUnique({
      where:  { id: payload.contactId },
      select: {
        id:                true,
        firstName:         true,
        lastName:          true,
        email:             true,
        accountStatus:     true,
        passwordChangedAt: true,
      },
    })
    if (!contact || contact.accountStatus !== 'active') return null

    // Invalidate tokens issued before the last password change
    if (contact.passwordChangedAt && typeof payload.iat === 'number') {
      if (payload.iat < contact.passwordChangedAt.getTime() / 1000) return null
    }
    return contact
  } catch {
    return null
  }
}

export async function getPendingContactId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('contact_pending_token')?.value
  if (!token) return null

  try {
    const payload = await verifyPendingContactJwt(token)
    return payload?.contactId ?? null
  } catch {
    return null
  }
}
