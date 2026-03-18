import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production')
}

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback_dev_secret_change_in_production'
)

const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d'

export async function signJwt(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(secret)
}

export async function verifyJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export async function signPendingJwt(userId: string): Promise<string> {
  return new SignJWT({ mfaPending: true, sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret)
}

export async function verifyPendingJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.mfaPending || !payload.sub) return null
    return payload
  } catch {
    return null
  }
}
