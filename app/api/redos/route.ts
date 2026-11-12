import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard } from "@/lib/session"

// Admins see every Redo; everyone else sees only their own.
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const all = (await readDB("redos")).redos
  return NextResponse.json(g.user.role === "Admin" ? all : all.filter((r) => r.userId === g.user.id))
}

// Admin: mark (redo: true, with an optional note) or clear (redo: false) a Redo.
export async function POST(request: Request) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const b = await request.json().catch(() => ({}))
  const db = await readDB("redos", "accounts", "courses")
  const person = db.accounts.find((a) => a.id === b.userId)
  if (!person || person.role === "Admin") return fail("Person not found.", 404)
  if (!db.courses.some((c) => c.id === b.courseId)) return fail("Course not found.", 404)

  db.redos = db.redos.filter((r) => !(r.userId === b.userId && r.courseId === b.courseId))
  if (b.redo === true) {
    db.redos.push({ userId: b.userId, courseId: b.courseId, note: String(b.note ?? "").slice(0, 300), createdAt: new Date().toISOString() })
  }
  await writeDB(db)
  return NextResponse.json({ ok: true })
}
