// Usage: node scripts/hash-password.mjs "the new password"
// Prints a value for ADMIN_PASSWORD_HASH in .env.local
import { randomBytes, scryptSync } from "node:crypto"
const pw = process.argv[2]
if (!pw) { console.error('Usage: node scripts/hash-password.mjs "password"'); process.exit(1) }
const salt = randomBytes(16).toString("hex")
console.log(`${salt}:${scryptSync(pw, salt, 64).toString("hex")}`)
