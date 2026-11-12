// Shared by the browser and the server. No Node imports here.

/** Small CSV reader: quoted fields, commas and line breaks inside quotes, "" for a quote. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(cell); cell = ""
      if (row.some((x) => x.trim() !== "")) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== "")) rows.push(row)
  return rows
}
