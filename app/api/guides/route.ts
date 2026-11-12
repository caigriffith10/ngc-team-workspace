import { NextResponse } from "next/server"
import { readDB, writeDB } from "@/lib/db"
import { guard, guardPerm, permsFor } from "@/lib/session"
import { Guide, canSeeGuide, uid } from "@/lib/types"

// Everyone signed in can read the guides.
export async function GET() {
  const g = await guard()
  if ("res" in g) return g.res
  const canEdit = (await permsFor(g.user)).includes("editGuides")
  return NextResponse.json(
    (await readDB("guides")).guides.filter((x) => canSeeGuide(x, g.user, canEdit)).map((x) => ({
      id: x.id, title: x.title, program: x.program, summary: x.summary, authorName: x.authorName,
      updatedAt: x.updatedAt, fileCount: x.files.length, restricted: x.roles.length + x.assignedTo.length > 0,
    })),
  )
}

// Admins and Senior Leads start a new guide.
export async function POST() {
  const g = await guardPerm("editGuides")
  if ("res" in g) return g.res
  const now = new Date().toISOString()
  const guide: Guide = {
    id: uid(), title: "Untitled guide", program: "", summary: "", html: "", files: [], roles: [], assignedTo: [],
    authorId: g.user.id, authorName: g.user.name, createdAt: now, updatedAt: now,
  }
  const db = await readDB("guides")
  db.guides.push(guide)
  await writeDB(db)
  return NextResponse.json({ id: guide.id })
}
