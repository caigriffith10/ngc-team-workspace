import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { fail, guard } from "@/lib/session"

type Ctx = { params: Promise<{ name: string }> }

const SKILLS = ["ngc-lesson-builder", "ngc-quiz-builder", "ngc-schedule-builder"]

// Admin only: download a Claude skill zip (kept in the skills folder, not in public).
export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { name } = await params
  if (!SKILLS.includes(name)) return fail("Skill not found.", 404)
  const file = path.join(process.cwd(), "skills", `${name}.zip`)
  if (!fs.existsSync(file)) return fail("That skill file is missing from the skills folder.", 404)
  return new NextResponse(fs.readFileSync(file), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}.zip"`, "Cache-Control": "no-store" },
  })
}
