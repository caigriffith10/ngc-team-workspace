import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard } from "@/lib/session"

// Admin: assign a course to one person (assigned: true) or take the assignment away (false).
export async function POST(request: Request) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const b = await request.json().catch(() => ({}))
  const db = await readDB()
  const person = db.accounts.find((a) => a.id === b.userId)
  if (!person || person.role === "Admin") return fail("Person not found.", 404)
  const course = db.courses.find((c) => c.id === b.courseId)
  if (!course) return fail("Course not found.", 404)
  course.assignedTo = course.assignedTo.filter((u) => u !== person.id)
  if (b.assigned === true) course.assignedTo.push(person.id)
  await writeDB(db)
  return NextResponse.json({ ok: true })
}
