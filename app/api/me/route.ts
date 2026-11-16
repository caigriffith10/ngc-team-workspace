import { NextResponse } from "next/server"
import { passwordMatches, encryptPassword } from "@/lib/crypto"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard, permsFor, publicAccount } from "@/lib/session"
import { USERNAME_RULE, cleanUsername, isValidUsername, usernameKey } from "@/lib/username"

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
  if (body.theme === "light" || body.theme === "dark") me.theme = body.theme
  if (typeof body.username === "string") {
    const u = cleanUsername(body.username)
    if (!isValidUsername(u)) return fail(USERNAME_RULE)
    if (db.accounts.some((a) => a.id !== me.id && usernameKey(a.username) === usernameKey(u))) return fail("That username is already taken.")
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
