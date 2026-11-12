import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { guard } from "@/lib/session"
import { isTargeted, isVisibleTo } from "@/lib/status"
import { Course, uid } from "@/lib/types"

export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const isAdmin = g.user.role === "Admin"
  // List view only needs summaries, so skip the (possibly large) page contents.
  const summaries = (await readDB("courses")).courses
    .filter((c) => isVisibleTo(c, g.user))
    .map((c) => ({
      id: c.id, title: c.title, type: c.type, program: c.program, description: c.description, minMinutes: c.minMinutes,
      published: c.published, pageCount: c.pages.length, updatedAt: c.updatedAt,
      quizQuestions: c.pages.flatMap((p) => p.blocks).reduce((n, b) => n + (b.type === "quiz" ? b.questions.length : 0), 0),
      // Admins see who it's aimed at. Everyone else only learns whether it's required for them.
      ...(isAdmin ? { roles: c.roles, assignedTo: c.assignedTo } : { required: isTargeted(c) }),
    }))
  return NextResponse.json(summaries)
}

export async function POST() {
  const g = await guard(true)
  if ("res" in g) return g.res
  const now = new Date().toISOString()
  const course: Course = {
    id: uid(), title: "Untitled course", type: "", program: "", description: "", minMinutes: null, published: false,
    roles: [], assignedTo: [], pages: [{ id: uid(), title: "Page 1", blocks: [] }], createdAt: now, updatedAt: now,
  }
  const db = await readDB()
  db.courses.push(course)
  await writeDB(db)
  return NextResponse.json({ id: course.id })
}
