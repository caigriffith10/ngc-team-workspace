import { NextResponse } from "next/server"
import { ATTENDANCE_SHEET_URL } from "@/lib/contact"
import { parseCsv } from "@/lib/csv"
import { isSheetUrl } from "@/lib/links"
import { guardPerm } from "@/lib/session"

/** A normal Google Sheets link becomes its CSV download link. Other links are used as they are. */
function toCsvUrl(url: string): string {
  const m = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/.exec(url)
  if (!m) return url
  const gid = /[#&?]gid=(\d+)/.exec(url)?.[1]
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`
}

// Admins and Senior Leads: read Instructor Attendance from the Google spreadsheet.
// The link lives in code (ATTENDANCE_SHEET_URL in lib/contact.ts) or in .env.local (ATTENDANCE_SHEET_URL).
export async function GET() {
  const g = await guardPerm("viewAttendance")
  if ("res" in g) return g.res
  const url = (process.env.ATTENDANCE_SHEET_URL || ATTENDANCE_SHEET_URL).trim()
  const base = { sourceUrl: url, fetchedAt: new Date().toISOString() }
  if (!url) return NextResponse.json({ ...base, connected: false, message: "The attendance spreadsheet isn't connected yet." })
  if (!isSheetUrl(url)) return NextResponse.json({ ...base, connected: false, message: "The attendance spreadsheet link must be a https://docs.google.com/spreadsheets/... link." })
  try {
    const res = await fetch(toCsvUrl(url), { signal: AbortSignal.timeout(8000), cache: "no-store" })
    const text = await res.text()
    const looksLikeHtml = /^\s*<(!doctype|html)/i.test(text)
    if (!res.ok || looksLikeHtml || !text.trim()) {
      return NextResponse.json({ ...base, connected: false, message: "That link isn't a shared spreadsheet yet. In Google Sheets, set Share to Anyone with the link (Viewer)." })
    }
    const rows = parseCsv(text).slice(0, 2001).map((r) => r.slice(0, 60).map((c) => c.slice(0, 500)))
    return NextResponse.json({ ...base, connected: true, header: rows[0] ?? [], rows: rows.slice(1) })
  } catch {
    return NextResponse.json({ ...base, connected: false, message: "Couldn't reach the spreadsheet. Check your internet connection and the link." })
  }
}
