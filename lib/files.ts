import { NextResponse } from "next/server"
import { parseDataUrl } from "./validate"

/** Sends a stored data-URL file as a download. Only allow-listed types ever get here (see ALLOWED_MIMES). */
export function fileDownload(data: string, name: string): NextResponse {
  const info = parseDataUrl(data)
  if (!info) return NextResponse.json({ error: "File is not available." }, { status: 404 })
  const body = Buffer.from(data.slice(data.indexOf(";base64,") + 8), "base64")
  const safe = name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "download"
  return new NextResponse(body, {
    headers: {
      "Content-Type": info.mime,
      "Content-Disposition": `attachment; filename="${safe}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  })
}
