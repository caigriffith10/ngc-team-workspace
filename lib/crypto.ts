import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

/*
 * Passwords are encrypted (not one-way hashed) because the owners asked that
 * admins can view them. Anyone with the AUTH_SECRET AND the database file can
 * read them, so keep both private. Switch to hashing + "reset password"
 * before this holds real people's data.
 */
function key(): Buffer {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short (see .env.example)")
  return scryptSync(s, "ngc-workspace-passwords", 32)
}

export function encryptPassword(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(":")
}

export function decryptPassword(stored: string): string {
  try {
    const [iv, tag, enc] = stored.split(":").map((p) => Buffer.from(p, "base64"))
    const d = createDecipheriv("aes-256-gcm", key(), iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8")
  } catch {
    return ""
  }
}

/** Constant-time check of a typed password against a stored one. */
export function passwordMatches(typed: string, stored: string): boolean {
  const a = createHash("sha256").update(typed).digest()
  const b = createHash("sha256").update(decryptPassword(stored)).digest()
  return timingSafeEqual(a, b) && decryptPassword(stored) !== ""
}
