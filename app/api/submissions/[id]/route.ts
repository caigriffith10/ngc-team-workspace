import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard } from "@/lib/session"

type Ctx = { params: Promise<{ id: string }> }

// Admin: everything about one submission (answers, written responses, uploaded files).
export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const db = await readDB()
  const c = db.completions.find((x) => x.id === id)
  if (!c) return fail("Submission not found.", 404)
  const user = db.accounts.find((a) => a.id === c.userId)
  const course = db.courses.find((x) => x.id === c.courseId)
  const confirmer = db.accounts.find((a) => a.id === c.confirmedBy)
  return NextResponse.json({
    completion: { ...c, files: c.files.map(({ data: _data, ...rest }) => rest) }, // file contents come from the download route
    user: user ? { id: user.id, name: user.name, role: user.role } : null,
    course: course ?? null, // includes the answer key, admin only
    confirmedByName: confirmer?.name ?? "",
  })
}

// Admin: confirm that the completion is real, or take the confirmation back.
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const db = await readDB()
  const c = db.completions.find((x) => x.id === id)
  if (!c) return fail("Submission not found.", 404)
  if (b.action === "confirm") {
    if (!c.passed) return fail("That attempt did not pass, so there's nothing to confirm.")
    c.confirmedAt = new Date().toISOString()
    c.confirmedBy = g.user.id
  } else if (b.action === "unconfirm") {
    c.confirmedAt = null
    c.confirmedBy = null
  } else return fail("Bad action.")
  await writeDB(db)
  return NextResponse.json({ ok: true, confirmedAt: c.confirmedAt })
}
