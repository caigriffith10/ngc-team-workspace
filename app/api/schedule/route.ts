import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { guard } from "@/lib/session"
import { sanitizeSchedule } from "@/lib/validate"

// Everyone signed in sees the schedule.
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  return NextResponse.json((await readDB("schedule")).schedule)
}

// Admin: replace the whole schedule (the editor sends every day).
export async function PUT(request: Request) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const body = await request.json().catch(() => null)
  const db = await readDB("schedule")
  db.schedule = sanitizeSchedule(body?.days)
  await writeDB(db)
  return NextResponse.json(db.schedule)
}
