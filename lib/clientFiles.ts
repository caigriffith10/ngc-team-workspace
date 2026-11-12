"use client"

import { ALLOWED_MIMES, MAX_FILE_BYTES } from "./types"

export type PickedFile = { name: string; mime: string; size: number; data: string }

const BY_EXT: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  txt: "text/plain", csv: "text/csv", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zip: "application/zip",
}

export const fmtSize = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`)

/** Reads a chosen file, checking its type and size. Throws a plain-English error if it isn't allowed. */
export async function readPickedFile(file: File): Promise<PickedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  let mime = file.type === "application/x-zip-compressed" ? "application/zip" : file.type
  if (!ALLOWED_MIMES[mime]) mime = BY_EXT[ext] ?? mime
  if (!ALLOWED_MIMES[mime]) throw new Error("That file type isn't allowed. Use PDF, image, Word, PowerPoint, Excel, text, CSV or ZIP.")
  if (file.size > MAX_FILE_BYTES) throw new Error(`That file is ${fmtSize(file.size)}. The limit is ${fmtSize(MAX_FILE_BYTES)}.`)
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error("Couldn't read that file."))
    r.readAsDataURL(file)
  })
  return { name: file.name, mime, size: file.size, data: `data:${mime};base64,${raw.slice(raw.indexOf(",") + 1)}` }
}
