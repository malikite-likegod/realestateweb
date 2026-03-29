import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'portal_pkg_session'
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret')

export interface PkgSession {
  contactId: string
  packageId: string
}

export async function setPackageSessionCookie(session: PkgSession): Promise<void> {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getPackageSession(): Promise<PkgSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as PkgSession
  } catch {
    return null
  }
}
