"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pill } from "@/components/StatusPill"
import { api } from "@/lib/client"

type Sheet =
  | { connected: true; header: string[]; rows: string[][]; sourceUrl: string; fetchedAt: string }
  | { connected: false; message: string; sourceUrl: string; fetchedAt: string }
type Person = { id: string; name: string; role: string; email?: string }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

function tone(value: string): string {
  const v = value.trim().toLowerCase()
  if (!v) return "gray"
  if (/^(present|here|yes|y|✓|✔|attended|on time|late)\b/.test(v)) return "green"
  if (/^(absent|no|n|✗|✘|missed|did not)\b/.test(v)) return "red"
  return "gray"
}

type Line = { key: string; name: string; role: string; status: string; asOf: string; found: boolean; onSite: boolean }

export default function InstructorAttendance() {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [people, setPeople] = useState<Person[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try { setSheet(await api<Sheet>("/api/attendance-sheet")) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    api<Person[]>("/api/people").then(setPeople).catch(() => setPeople([]))
    void load()
  }, [load])

  // One line per instructor: matched to the spreadsheet by name (or email), with the status written there.
  const lines = useMemo<Line[]>(() => {
    if (!people) return []
    const out: Line[] = []
    let data: { header: string[]; rows: string[][] } | null = null
    if (sheet?.connected) data = { header: sheet.header, rows: sheet.rows }
    const h = data?.header ?? []
    const nameCol = h.findIndex((x) => /name|instructor/i.test(x))
    const emailCol = h.findIndex((x) => /e-?mail/i.test(x))
    const statusCol = h.findIndex((x) => /status|attendance|present|here/i.test(x))
    const used = new Set<number>()

    const pick = (row: string[]): { status: string; asOf: string } => {
      if (statusCol >= 0) return { status: (row[statusCol] ?? "").trim(), asOf: "" }
      // No status column: use the last filled-in cell (a sheet with one column per class day).
      for (let c = row.length - 1; c >= 0; c--) {
        if (c === nameCol || c === emailCol) continue
        if ((row[c] ?? "").trim()) return { status: row[c].trim(), asOf: h[c] ?? "" }
      }
      return { status: "", asOf: "" }
    }

    for (const p of people) {
      let idx = -1
      if (data) {
        idx = data.rows.findIndex((r, i) => !used.has(i) && ((nameCol >= 0 && norm(r[nameCol] ?? "") === norm(p.name)) || (emailCol >= 0 && p.email && norm(r[emailCol] ?? "") === norm(p.email))))
        if (idx >= 0) used.add(idx)
      }
      const got = idx >= 0 && data ? pick(data.rows[idx]) : { status: "", asOf: "" }
      out.push({ key: p.id, name: p.name, role: p.role, status: got.status, asOf: got.asOf, found: idx >= 0, onSite: true })
    }
    if (data && nameCol >= 0) {
      data.rows.forEach((r, i) => {
        if (used.has(i) || !(r[nameCol] ?? "").trim()) return
        const got = pick(r)
        out.push({ key: `sheet-${i}`, name: r[nameCol].trim(), role: "", status: got.status, asOf: got.asOf, found: true, onSite: false })
      })
    }
    return out
  }, [people, sheet])

  const shown = query.trim() ? lines.filter((l) => l.name.toLowerCase().includes(query.trim().toLowerCase())) : lines

  return (
    <main className="dash-main">
      <div className="page-title">
        <div>
          <h1>Instructor Attendance</h1>
          <p>Every instructor and their attendance status, read from the Google spreadsheet.</p>
        </div>
        <div className="btn-row">
          {sheet?.sourceUrl && <a className="btn btn-outline" href={sheet.sourceUrl} target="_blank" rel="noopener noreferrer">Open spreadsheet</a>}
          <button className="btn btn-outline" onClick={load} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div>
      </div>

      {sheet && !sheet.connected && <div className="notice warn">{sheet.message}</div>}

      <div className="toolbar">
        <input className="input" style={{ maxWidth: "20rem" }} aria-label="Search instructors" placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {lines.length} instructor{lines.length === 1 ? "" : "s"}{sheet?.connected ? ` · updated ${new Date(sheet.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
        </span>
      </div>

      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Instructor</th><th>Role</th><th>Attendance status</th></tr></thead>
          <tbody>
            {people && shown.length === 0 && <tr><td colSpan={3} className="muted center">{lines.length === 0 ? "No instructors yet." : "No one matches."}</td></tr>}
            {shown.map((l) => (
              <tr key={l.key}>
                <td>{l.name}{!l.onSite && <span className="muted"> (not on the site)</span>}</td>
                <td>{l.role ? <span className="chip">{l.role}</span> : <span className="muted">—</span>}</td>
                <td>
                  {l.status
                    ? <><Pill tone={tone(l.status)}>{l.status}</Pill>{l.asOf && <span className="muted" style={{ marginLeft: ".5rem", fontSize: ".82rem" }}>{l.asOf}</span>}</>
                    : <span className="muted">{sheet?.connected ? (l.found ? "—" : "Not in the spreadsheet") : "Not connected"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
