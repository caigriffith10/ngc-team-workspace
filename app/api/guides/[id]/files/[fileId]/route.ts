import { readDB } from "@/lib/db"
import { fileDownload } from "@/lib/files"
import { fail, guard, permsFor } from "@/lib/session"
import { canSeeGuide } from "@/lib/types"

type Ctx = { params: Promise<{ id: string; fileId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const { id, fileId } = await params
  const guide = (await readDB("guides")).guides.find((x) => x.id === id)
  const file = guide && canSeeGuide(guide, g.user, (await permsFor(g.user)).includes("editGuides")) ? guide.files.find((f) => f.id === fileId) : undefined
  if (!file) return fail("File not found.", 404)
  return fileDownload(file.data, file.name)
}
