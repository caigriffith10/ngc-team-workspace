import { NextResponse } from "next/server"
import { passwordMatches, encryptPassword } from "@/lib/crypto"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard, permsFor, publicAccount } from "@/lib/session"

export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  return NextResponse.json({ ...publicAccount(g.user), permissions: await permsFor(g.user) })
}

// Change your own username and/or password.
export async function PATCH(request: Request) {
  const g = await guard()
  if ("res" in g) return g.res
  const body = await request.json().catch(() => ({}))
  const db = await readDB("accounts")
  const me = db.accounts.find((a) => a.id === g.user.id)!

  if (typeof body.name === "string") {
    const n = body.name.trim().slice(0, 100)
    if (!n) return fail("Enter a name.")
    me.name = n
  }
  if (typeof body.username === "string") {
    const u = body.username.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) return fail("Username: 3-30 characters, letters, numbers, . _ - only.")
    if (db.accounts.some((a) => a.id !== me.id && a.username === u)) return fail("That username is already taken.")
    me.username = u
  }
  if (typeof body.newPassword === "string" && body.newPassword !== "") {
    if (!passwordMatches(String(body.currentPassword ?? ""), me.password)) return fail("Current password is incorrect.", 403)
    if (body.newPassword.length < 6 || body.newPassword.length > 100) return fail("Password must be 6-100 characters.")
    me.password = encryptPassword(body.newPassword)
  }
  await writeDB(db)
  return NextResponse.json(publicAccount(me))
}
