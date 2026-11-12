import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { badRoleName, cleanPermissions, cleanRoleName } from "@/lib/roles"
import { fail, guard } from "@/lib/session"
import { BUILT_IN_ROLES, RoleDef, permissionsOfBuiltIn, uid } from "@/lib/types"

// Everyone signed in can read the list (the role pickers use it).
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const db = await readDB("accounts", "customRoles")
  return NextResponse.json({
    builtIn: BUILT_IN_ROLES.map((name) => ({ name, permissions: permissionsOfBuiltIn(name), members: db.accounts.filter((a) => a.role === name).length })),
    custom: db.customRoles.map((r) => ({ ...r, members: db.accounts.filter((a) => a.role === r.name).length })),
  })
}

// Admin: make a custom role.
export async function POST(request: Request) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const b = await request.json().catch(() => ({}))
  const db = await readDB("customRoles")
  const name = cleanRoleName(b.name)
  const bad = badRoleName(name, db.customRoles)
  if (bad) return fail(bad)
  const role: RoleDef = { id: uid(), name, permissions: cleanPermissions(b.permissions) }
  db.customRoles.push(role)
  await writeDB(db)
  return NextResponse.json(role)
}
