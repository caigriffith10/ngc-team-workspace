import { NextResponse } from "next/server"
import { readDB } from "@/lib/db"
import { guard } from "@/lib/session"
import { Completion, CompletionSummary } from "@/lib/types"

const summarize = (c: Completion): CompletionSummary => ({
  id: c.id, userId: c.userId, courseId: c.courseId, completedAt: c.completedAt, score: c.score, total: c.total,
  passed: c.passed, timeSpentSec: c.timeSpentSec, confirmedAt: c.confirmedAt,
  fileCount: c.files.length, responseCount: Object.keys(c.responses).length,
})

// Lists never include answers, written responses or file contents. Admins open one submission to see those.
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const all = (await readDB("completions")).completions
  return NextResponse.json((g.user.role === "Admin" ? all : all.filter((c) => c.userId === g.user.id)).map(summarize))
}
