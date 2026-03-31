import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable must be set in production')
    }
    return new TextEncoder().encode('fallback_dev_secret_change_in_production')
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long')
  }
  return new TextEncoder().encode(secret)
}

function getExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '7d'
}

export async function signJwt(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(getExpiresIn())
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
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
    .sign(getSecret())
}

export async function verifyPendingJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.mfaPending || !payload.sub) return null
    return payload
  } catch {
    return null
  }
}

export async function signContactJwt(contactId: string, email: string): Promise<string> {
  const contactExpiresIn = process.env.CONTACT_JWT_EXPIRES_IN ?? '7d'
  return new SignJWT({ sub: contactId, email, type: 'contact' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(contactExpiresIn)
    .sign(getSecret())
}

export async function signPendingContactJwt(contactId: string): Promise<string> {
  return new SignJWT({ sub: contactId, type: 'contact_pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecret())
}

export async function verifyContactJwt(token: string): Promise<{ contactId: string; email: string; iat?: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.type !== 'contact' || !payload.sub || !payload.email) return null
    return { contactId: payload.sub as string, email: payload.email as string, iat: payload.iat }
  } catch {
    return null
  }
}

export async function verifyPendingContactJwt(token: string): Promise<{ contactId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.type !== 'contact_pending' || !payload.sub) return null
    return { contactId: payload.sub as string }
  } catch {
    return null
  }
}

/** Signs the re_verified cookie so it carries a verifiable contact ID rather than a raw DB id. */
export async function signVerifiedContactCookie(contactId: string): Promise<string> {
  return new SignJWT({ sub: contactId, type: 'gate_verified' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y')
    .sign(getSecret())
}

/** Verifies the re_verified cookie and returns the contact ID, or null if invalid/tampered. */
export async function verifyVerifiedContactCookie(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.type !== 'gate_verified' || !payload.sub) return null
    return payload.sub as string
  } catch {
    return null
  }
}
