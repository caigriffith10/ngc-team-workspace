import { NextResponse } from "next/server"
import { readPayload } from "@/lib/auth"
import { readDB, writeDB } from "@/lib/db"
import { fail, guard } from "@/lib/session"
import { isVisibleTo } from "@/lib/status"
import { Completion, PASS_PERCENT, SubmittedFile, uid } from "@/lib/types"
import { cleanSubmittedFile } from "@/lib/validate"

type Ctx = { params: Promise<{ id: string }> }

const normalize = (v: unknown, optionCount: number): number[] =>
  [...new Set((Array.isArray(v) ? v : [v]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < optionCount))].sort((a, b) => a - b)

// Grades quiz answers on the server so the answer key never reaches the browser.
// A passing attempt is saved as "awaiting confirmation" until an admin confirms it.
export async function POST(request: Request, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const { id } = await params
  const db = await readDB()
  const course = db.courses.find((c) => c.id === id)
  if (!course || !isVisibleTo(course, g.user)) return fail("Course not found.", 404)
  const isAdmin = g.user.role === "Admin"

  const body = await request.json().catch(() => ({}))
  const answers: Record<string, unknown> = typeof body.answers === "object" && body.answers ? body.answers : {}
  const responses: Record<string, unknown> = typeof body.responses === "object" && body.responses ? body.responses : {}
  const uploads: Record<string, unknown> = typeof body.uploads === "object" && body.uploads ? body.uploads : {}

  // Minimum time spent: measured from when the learner opened the course, using the signed note from the server.
  let timeSpentSec = 0
  if (!isAdmin) {
    const note = readPayload<{ c: string; u: string; t: number }>(body.startToken)
    const valid = !!note && note.c === id && note.u === g.user.id && typeof note.t === "number" && note.t <= Date.now()
    if (valid) timeSpentSec = Math.min(Math.floor((Date.now() - note.t) / 1000), 60 * 60 * 12)
    if (course.minMinutes) {
      if (!valid) return fail("Please reopen the course and try again.")
      const need = course.minMinutes * 60
      if (timeSpentSec < need - 2) return fail(`You can submit after ${course.minMinutes} minutes on this course. ${Math.ceil((need - timeSpentSec) / 60)} minute(s) to go.`)
    }
  }

  const results: Record<string, boolean> = {}
  const savedAnswers: Record<string, number[]> = {}
  const savedResponses: Record<string, string> = {}
  const files: SubmittedFile[] = []
  let score = 0
  let total = 0
  for (const block of course.pages.flatMap((p) => p.blocks)) {
    if (block.type === "quiz") {
      for (const q of block.questions) {
        total++
        const given = normalize(answers[q.id], q.options.length)
        savedAnswers[q.id] = given
        const key = [...q.correct].sort((a, b) => a - b)
        const right = given.length === key.length && given.every((n, i) => n === key[i])
        results[q.id] = right
        if (right) score++
      }
    } else if (block.type === "response") {
      const text = typeof responses[block.id] === "string" ? (responses[block.id] as string).slice(0, 8000).trim() : ""
      if (!text) return fail(`Please write your answer for: "${block.prompt || "written answer"}".`)
      savedResponses[block.id] = text
    } else if (block.type === "upload") {
      const f = cleanSubmittedFile(uploads[block.id], block.id)
      if (!f) return fail(`Please upload a file (PDF, image, Word, PowerPoint, Excel, text or ZIP up to 3 MB) for: "${block.prompt || "file upload"}".`)
      files.push(f)
    }
  }
  const passed = total === 0 ? true : (score / total) * 100 >= PASS_PERCENT

  // Admins previewing a course don't create records.
  if (!isAdmin) {
    if (passed) db.redos = db.redos.filter((r) => !(r.userId === g.user.id && r.courseId === id))
    const rec: Completion = {
      id: uid(), userId: g.user.id, courseId: id, completedAt: new Date().toISOString(), score, total, passed,
      timeSpentSec, answers: savedAnswers, responses: savedResponses, files, confirmedAt: null, confirmedBy: null,
    }
    db.completions.push(rec)
    await writeDB(db)
  }
  return NextResponse.json({ score, total, passed, results, passPercent: PASS_PERCENT, awaiting: passed && !isAdmin })
}
