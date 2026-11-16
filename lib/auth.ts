import { createHmac, timingSafeEqual } from "node:crypto"

export const COOKIE_NAME = "ngc_session"
export const SESSION_SECONDS = 60 * 60 * 8 // 8 hours
export const REMEMBER_SECONDS = 60 * 60 * 24 * 90 // "Remember me": stays signed in until Sign out (max 90 days)

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short (see .env.example)")
  return s
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url")

export function createSession(accountId: string, seconds = SESSION_SECONDS, version = 0): string {
  const payload = Buffer.from(JSON.stringify({ id: accountId, v: version, exp: Math.floor(Date.now() / 1000) + seconds })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

/** A small signed note, used to prove when a learner opened a course (for the minimum-time rule). */
export function signPayload(obj: object): string {
  const payload = Buffer.from(JSON.stringify(obj)).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function readPayload<T>(token: unknown): T | null {
  if (typeof token !== "string") return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()) as T } catch { return null }
}

/** Returns the account id if the token is genuine and unexpired, otherwise null. */
export const verifySession = (token: string | undefined): string | null => readSession(token)?.id ?? null

/** Like verifySession, but also returns the account's session version the cookie was made with. */
export function readSession(token: string | undefined): { id: string; v: number } | null {
  if (!token) return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const { id, exp, v } = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (typeof id !== "string" || typeof exp !== "number" || exp < Date.now() / 1000) return null
    return { id, v: typeof v === "number" ? v : 0 }
  } catch {
    return null
  }
}
