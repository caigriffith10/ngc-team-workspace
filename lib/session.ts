import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { COOKIE_NAME, verifySession } from "./auth"
import { readDB } from "./db"
import { Account, Permission, PublicAccount, permissionsOf } from "./types"

export const publicAccount = ({ password: _pw, ...rest }: Account): PublicAccount => rest

/** The signed-in account, or null. Re-checks the database so deleted accounts lose access immediately. */
export async function getUser(): Promise<Account | null> {
  const id = verifySession((await cookies()).get(COOKIE_NAME)?.value)
  if (!id) return null
  return (await readDB("accounts")).accounts.find((a) => a.id === id) ?? null
}

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

/** Use at the top of an API route: const g = await guard(); if ("res" in g) return g.res */
export async function guard(adminOnly = false): Promise<{ user: Account } | { res: NextResponse }> {
  const user = await getUser()
  if (!user) return { res: fail("Not signed in.", 401) }
  if (adminOnly && user.role !== "Admin") return { res: fail("Admins only.", 403) }
  return { user }
}

/** Like guard, but lets through any of the listed roles. */
export async function guardRoles(roles: string[]): Promise<{ user: Account } | { res: NextResponse }> {
  const user = await getUser()
  if (!user) return { res: fail("Not signed in.", 401) }
  if (!roles.includes(user.role)) return { res: fail("You don't have permission to do that.", 403) }
  return { user }
}

/** What this account's role lets them do (read fresh from the database, so role edits apply at once). */
export const permsFor = async (user: Pick<Account, "role">): Promise<Permission[]> => permissionsOf(user.role, (await readDB("customRoles")).customRoles)

/** Like guard, but lets through anyone whose role has the permission. */
export async function guardPerm(perm: Permission): Promise<{ user: Account } | { res: NextResponse }> {
  const user = await getUser()
  if (!user) return { res: fail("Not signed in.", 401) }
  if (!(await permsFor(user)).includes(perm)) return { res: fail("You don't have permission to do that.", 403) }
  return { user }
}

/** Today's date in Georgia time, so "today" doesn't flip at 7pm. */
export function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
}

/** For admin-only PAGES: non-admins are sent back to the dashboard before anything renders. */
export async function requireAdminPage() {
  const user = await getUser()
  if (!user) redirect("/")
  if (user.role !== "Admin") redirect("/dashboard")
}

/** For pages only roles with a permission may open (others are sent to the dashboard). */
export async function requirePermPage(perm: Permission, to = "/dashboard") {
  const user = await getUser()
  if (!user) redirect("/")
  if (!(await permsFor(user)).includes(perm)) redirect(to)
}

/** For pages only some roles may open (others are sent to the dashboard). */
export async function requireRolesPage(roles: string[], to = "/dashboard") {
  const user = await getUser()
  if (!user) redirect("/")
  if (!roles.includes(user.role)) redirect(to)
}
