import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard, guardPerm, permsFor } from "@/lib/session"
import { assignableRoles, canSeeGuide } from "@/lib/types"
import { sanitizeGuide } from "@/lib/validate"

type Ctx = { params: Promise<{ id: string }> }

// File contents are not sent here (each file has its own download address).
const lite = <T extends { files: { data: string }[] }>(x: T) => ({ ...x, files: x.files.map(({ data: _d, ...f }) => f) })

export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const { id } = await params
  const guide = (await readDB("guides")).guides.find((x) => x.id === id)
  if (!guide || !canSeeGuide(guide, g.user, (await permsFor(g.user)).includes("editGuides"))) return fail("Guide not found.", 404)
  return NextResponse.json(lite(guide))
}

export async function PUT(request: Request, { params }: Ctx) {
  const g = await guardPerm("editGuides")
  if ("res" in g) return g.res
  const { id } = await params
  const db = await readDB("guides", "customRoles")
  const idx = db.guides.findIndex((x) => x.id === id)
  if (idx === -1) return fail("Guide not found.", 404)
  const body = await request.json().catch(() => null)
  if (!body) return fail("Bad request.")
  db.guides[idx] = sanitizeGuide(body, db.guides[idx], assignableRoles(db.customRoles))
  await writeDB(db)
  return NextResponse.json(lite(db.guides[idx]))
}

// Admins can delete any guide. Senior Leads can delete the ones they wrote.
export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guardPerm("editGuides")
  if ("res" in g) return g.res
  const { id } = await params
  const db = await readDB("guides")
  const guide = db.guides.find((x) => x.id === id)
  if (!guide) return fail("Guide not found.", 404)
  if (g.user.role !== "Admin" && guide.authorId !== g.user.id) return fail("Only an admin or the author can delete this guide.", 403)
  db.guides = db.guides.filter((x) => x.id !== id)
  await writeDB(db)
  return NextResponse.json({ ok: true })
}
