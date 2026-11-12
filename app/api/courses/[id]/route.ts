import { NextResponse } from "next/server"
import { signPayload } from "@/lib/auth"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard } from "@/lib/session"
import { isTargeted, isVisibleTo } from "@/lib/status"
import { assignableRoles } from "@/lib/types"
import { sanitizeCourse, stripAnswers } from "@/lib/validate"

type Ctx = { params: Promise<{ id: string }> }

// ?view=learn is what the course player uses: answer key removed, even for admins.
export async function GET(request: Request, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const { id } = await params
  const course = (await readDB("courses")).courses.find((c) => c.id === id)
  if (!course || !isVisibleTo(course, g.user)) return fail("Course not found.", 404)
  const isAdmin = g.user.role === "Admin"
  const learn = new URL(request.url).searchParams.get("view") === "learn"
  if (isAdmin && !learn) return NextResponse.json(course)
  // Learners get the course without the answer key or who else it is assigned to,
  // plus a signed note of when they opened it (the server enforces the minimum time).
  return NextResponse.json({
    ...stripAnswers(course),
    roles: [],
    assignedTo: [],
    required: isTargeted(course),
    startToken: isAdmin ? "" : signPayload({ c: course.id, u: g.user.id, t: Date.now() }),
  })
}

export async function PUT(request: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const db = await readDB()
  const idx = db.courses.findIndex((c) => c.id === id)
  if (idx === -1) return fail("Course not found.", 404)
  const body = await request.json().catch(() => null)
  if (!body) return fail("Bad request.")
  const next = sanitizeCourse(body, db.courses[idx], assignableRoles(db.customRoles))
  const real = new Set(db.accounts.filter((a) => a.role !== "Admin").map((a) => a.id))
  next.assignedTo = next.assignedTo.filter((u) => real.has(u))
  db.courses[idx] = next
  await writeDB(db)
  return NextResponse.json(db.courses[idx])
}

// Admin: publish or unpublish without touching anything else.
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  if (typeof b.published !== "boolean") return fail("Bad request.")
  const db = await readDB()
  const course = db.courses.find((c) => c.id === id)
  if (!course) return fail("Course not found.", 404)
  course.published = b.published
  course.updatedAt = new Date().toISOString()
  await writeDB(db)
  return NextResponse.json({ ok: true, published: course.published })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id } = await params
  const db = await readDB()
  db.courses = db.courses.filter((c) => c.id !== id)
  db.completions = db.completions.filter((c) => c.courseId !== id)
  db.redos = db.redos.filter((r) => r.courseId !== id)
  await writeDB(db)
  return NextResponse.json({ ok: true })
}
