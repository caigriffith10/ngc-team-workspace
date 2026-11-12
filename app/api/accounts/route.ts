import { NextResponse } from "next/server"
import { decryptPassword, encryptPassword } from "@/lib/crypto"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard, publicAccount } from "@/lib/session"
import { Account, BUILT_IN_ROLES, uid } from "@/lib/types"

// Admin-only: the full list, including the passwords admins assigned.
export async function GET() {
  const g = await guard(true)
  if ("res" in g) return g.res
  return NextResponse.json((await readDB("accounts")).accounts.map((a) => ({ ...publicAccount(a), password: decryptPassword(a.password) })))
}

export async function POST(request: Request) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const b = await request.json().catch(() => ({}))
  const name = String(b.name ?? "").trim().slice(0, 100)
  const username = String(b.username ?? "").trim().toLowerCase()
  const email = String(b.email ?? "").trim().slice(0, 200)
  const password = String(b.password ?? "")
  const role = b.role

  if (!name) return fail("Enter a name.")
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return fail("Username: 3-30 characters, letters, numbers, . _ - only.")
  if (password.length < 6 || password.length > 100) return fail("Password must be 6-100 characters.")
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email doesn't look right.")

  const db = await readDB("accounts", "customRoles")
  if (typeof role !== "string" || ![...BUILT_IN_ROLES, ...db.customRoles.map((r) => r.name)].includes(role)) return fail("Pick a role.")
  if (db.accounts.some((a) => a.username === username)) return fail("That username is already taken.")
  const account: Account = { id: uid(), name, username, email, role, password: encryptPassword(password), createdAt: new Date().toISOString() }
  db.accounts.push(account)
  await writeDB(db)
  return NextResponse.json({ ...publicAccount(account), password })
}
