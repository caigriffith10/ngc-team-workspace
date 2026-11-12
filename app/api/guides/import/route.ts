import { NextResponse } from "next/server"
import { fail, guard } from "@/lib/session"
import { plainToHtml, sanitizeHtml } from "@/lib/sanitize"

export const runtime = "nodejs"

const MAX_SOURCE_BYTES = 10_000_000

// Admin: turn an uploaded PDF or Word (.docx) file into guide text. Nothing is saved here;
// the guide editor puts the result in the draft so the admin can review it first.
export async function POST(request: Request) {
  const g = await guard(true)
  if ("res" in g) return g.res
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return fail("Choose a PDF or Word file.")
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES) return fail("That file is empty or over 10 MB.")
  const name = file.name
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const buf = Buffer.from(await file.arrayBuffer())
  const title = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200)

  try {
    if (ext === "docx") {
      const mammoth = await import("mammoth")
      const { value } = await mammoth.convertToHtml(
        { buffer: buf },
        { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
      )
      const html = sanitizeHtml(value.replace(/<img[^>]*>/g, ""), 120000)
      if (!html.trim()) return fail("No text was found in that Word file.")
      return NextResponse.json({ title, html })
    }
    if (ext === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf")
      const pdf = await getDocumentProxy(new Uint8Array(buf))
      const { text } = await extractText(pdf, { mergePages: true })
      const html = sanitizeHtml(plainToHtml(String(text).slice(0, 100000)), 120000)
      if (!html.trim()) return fail("No text was found in that PDF (scanned PDFs can't be read).")
      return NextResponse.json({ title, html })
    }
    return fail("Only .pdf and .docx files can be imported. (Old .doc files: save as .docx first.)")
  } catch {
    return fail("Couldn't read that file. Try another one.")
  }
}
