import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { badRoleName, cleanPermissions, cleanRoleName } from "@/lib/roles"
import { fail, guard } from "@/lib/session"

type Ctx = { params: Promise<{ id: string }> }

// Admin: rename a custom role and/or change its permissions. A rename follows the role everywhere it is used.
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const db = await readDB()
  const role = db.customRoles.find((r) => r.id === id)
  if (!role) return fail("Role not found.", 404)
  if (b.name !== undefined) {
    const name = cleanRoleName(b.name)
    const bad = badRoleName(name, db.customRoles, id)
    if (bad) return fail(bad)
    if (name !== role.name) {
      for (const a of db.accounts) if (a.role === role.name) a.role = name
      for (const c of db.courses) c.roles = c.roles.map((r) => (r === role.name ? name : r))
      for (const x of db.guides) x.roles = x.roles.map((r) => (r === role.name ? name : r))
      role.name = name
    }
  }
  if (b.permissions !== undefined) role.permissions = cleanPermissions(b.permissions)
  await writeDB(db)
  return NextResponse.json(role)
}

// Admin: delete a custom role. Not allowed while people still have it.
export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const db = await readDB()
  const role = db.customRoles.find((r) => r.id === id)
  if (!role) return fail("Role not found.", 404)
  const members = db.accounts.filter((a) => a.role === role.name).length
  if (members > 0) return fail(`${members} ${members === 1 ? "account still has" : "accounts still have"} this role. Change their role on the Accounts page first.`)
  db.customRoles = db.customRoles.filter((r) => r.id !== id)
  for (const c of db.courses) c.roles = c.roles.filter((r) => r !== role.name)
  for (const x of db.guides) x.roles = x.roles.filter((r) => r !== role.name)
  await writeDB(db)
  return NextResponse.json({ ok: true })
}
