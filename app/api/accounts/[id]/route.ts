import { NextResponse } from "next/server"
import { encryptPassword } from "@/lib/crypto"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard } from "@/lib/session"
import { BUILT_IN_ROLES } from "@/lib/types"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const db = await readDB("accounts", "customRoles")
  const acct = db.accounts.find((a) => a.id === id)
  if (!acct) return fail("Account not found.", 404)

  if (typeof b.name === "string" && b.name.trim()) acct.name = b.name.trim().slice(0, 100)
  if (typeof b.email === "string") {
    const e = b.email.trim().slice(0, 200)
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return fail("That email doesn't look right.")
    acct.email = e
  }
  if (typeof b.username === "string") {
    const u = b.username.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) return fail("Username: 3-30 characters, letters, numbers, . _ - only.")
    if (db.accounts.some((a) => a.id !== id && a.username === u)) return fail("That username is already taken.")
    acct.username = u
  }
  if (b.role !== undefined) {
    if (typeof b.role !== "string" || ![...BUILT_IN_ROLES, ...db.customRoles.map((r) => r.name)].includes(b.role)) return fail("Pick a role.")
    if (id === g.user.id && b.role !== acct.role) return fail("You can't change your own role.")
    acct.role = b.role
  }
  if (typeof b.password === "string" && b.password !== "") {
    if (b.password.length < 6 || b.password.length > 100) return fail("Password must be 6-100 characters.")
    acct.password = encryptPassword(b.password)
  }
  await writeDB(db)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  if (id === g.user.id) return fail("You can't delete your own account.")
  const db = await readDB()
  db.accounts = db.accounts.filter((a) => a.id !== id)
  db.completions = db.completions.filter((c) => c.userId !== id)
  db.attendance = db.attendance.filter((r) => (r as { userId?: string }).userId !== id)
  db.redos = db.redos.filter((r) => r.userId !== id)
  for (const c of db.courses) c.assignedTo = c.assignedTo.filter((u) => u !== id)
  await writeDB(db)
  return NextResponse.json({ ok: true })
}
