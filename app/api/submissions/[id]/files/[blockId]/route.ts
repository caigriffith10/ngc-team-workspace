import { readDB } from "@/lib/db"
import { fileDownload } from "@/lib/files"
import { fail, guard } from "@/lib/session"

type Ctx = { params: Promise<{ id: string; blockId: string }> }

// Admin: download a file a learner uploaded.
export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const { id, blockId } = await params
  const file = (await readDB("completions")).completions.find((x) => x.id === id)?.files.find((f) => f.blockId === blockId)
  if (!file) return fail("File not found.", 404)
  return fileDownload(file.data, file.name)
}
