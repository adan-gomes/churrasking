import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

const SECRET = process.env.GUEST_SESSION_SECRET!
const COOKIE_NAME = 'guest_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

type GuestSession = {
  guestId: string
  eventId: string
}

function sign(payload: string) {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

export function createGuestSessionValue(session: GuestSession): string {
  const payload = JSON.stringify(session)
  const encoded = Buffer.from(payload).toString('base64')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function verifyGuestSession(value: string): GuestSession | null {
  const [encoded, signature] = value.split('.')
  if (!encoded || !signature) return null

  const expectedSignature = sign(encoded)
  if (signature !== expectedSignature) return null

  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

export async function setGuestSessionCookie(session: GuestSession): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, createGuestSessionValue(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie) return null

  return verifyGuestSession(cookie.value)
}
