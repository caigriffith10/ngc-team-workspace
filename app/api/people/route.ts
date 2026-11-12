import { NextResponse } from "next/server"
import { readDB } from "@/lib/db"
import { guard, permsFor } from "@/lib/session"

// Everyone except admins. Emails are only included for admins (for Send Class Email).
// Only admins and Senior Leads get the whole list; everyone else just gets themselves.
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const isAdmin = g.user.role === "Admin"
  const perms = await permsFor(g.user)
  const seeAll = perms.includes("viewAttendance") || perms.includes("editGuides")
  return NextResponse.json(
    (await readDB("accounts")).accounts
      .filter((a) => a.role !== "Admin" && (seeAll || a.id === g.user.id))
      .map((a) => ({ id: a.id, name: a.name, role: a.role, ...(isAdmin ? { email: a.email } : {}) })),
  )
}
