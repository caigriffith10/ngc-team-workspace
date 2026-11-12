import { NextResponse } from "next/server"
import { COOKIE_NAME, createSession } from "@/lib/auth"
import { passwordMatches } from "@/lib/crypto"
import { readDB, writeDB } from "@/lib/db"

// Failed-login limits, kept in the database so they hold even when the site runs on several servers (Vercel).
//   per network address: 10 failures / 10 minutes     per username: 10 failures / 15 minutes
const LIMITS = { ip: { max: 10, windowMs: 10 * 60_000 }, user: { max: 10, windowMs: 15 * 60_000 } }
const MAX_ENTRIES = 2000

const tooMany = () => NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 })

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 64)
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : ""
  const now = Date.now()

  const db = await readDB("accounts", "throttle")
  const ipKey = `ip:${ip}`
  const userKey = `user:${username.slice(0, 60)}`
  const live = (k: string) => { const e = db.throttle[k]; return e && e.resetAt > now ? e : null }
  if ((live(ipKey)?.count ?? 0) >= LIMITS.ip.max || (live(userKey)?.count ?? 0) >= LIMITS.user.max) return tooMany()

  const account = db.accounts.find((a) => a.username === username)
  // Check a password even for unknown usernames so timing doesn't reveal which usernames exist.
  const ok = account ? passwordMatches(password, account.password) : passwordMatches(password, "x:y:z") && false

  if (!account || !ok) {
    for (const [k, rule] of [[ipKey, LIMITS.ip], [userKey, LIMITS.user]] as const) {
      const e = live(k)
      db.throttle[k] = { count: (e?.count ?? 0) + 1, resetAt: e?.resetAt ?? now + rule.windowMs }
    }
    for (const k of Object.keys(db.throttle)) if (db.throttle[k].resetAt <= now) delete db.throttle[k]
    const keys = Object.keys(db.throttle)
    if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete db.throttle[k]
    await writeDB(db)
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 })
  }

  if (db.throttle[ipKey] || db.throttle[userKey]) { delete db.throttle[ipKey]; delete db.throttle[userKey]; await writeDB(db) }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, createSession(account.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8,
  })
  return res
}
