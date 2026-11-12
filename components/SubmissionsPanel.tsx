"use client"

import { useCallback, useEffect, useState } from "react"
import { useModal } from "@/lib/useModal"
import { Pill } from "@/components/StatusPill"
import { api, send } from "@/lib/client"
import { fmtSize } from "@/lib/clientFiles"
import { fmtMinutes } from "@/lib/status"
import { CompletionSummary, Course } from "@/lib/types"

type Person = { id: string; name: string; role: string }
type CourseLite = { id: string; title: string }

const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

export default function SubmissionsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<CompletionSummary[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [courses, setCourses] = useState<CourseLite[]>([])
  const [filter, setFilter] = useState<"awaiting" | "all">("awaiting")
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(() =>
    Promise.all([api<CompletionSummary[]>("/api/completions"), api<Person[]>("/api/people"), api<CourseLite[]>("/api/courses")])
      .then(([c, p, k]) => { setRows([...c].sort((a, b) => b.completedAt.localeCompare(a.completedAt))); setPeople(p); setCourses(k) })
      .catch((e) => setError(e.message)), [])
  useEffect(() => { load() }, [load])

  const shown = rows.filter((r) => filter === "all" || (r.passed && !r.confirmedAt))
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "(deleted account)"
  const title = (id: string) => courses.find((c) => c.id === id)?.title ?? "(deleted course)"

  async function quickConfirm(id: string) {
    try { await api(`/api/submissions/${id}`, send("PATCH", { action: "confirm" })); await load(); onChanged?.() } catch (e) { setError((e as Error).message) }
  }

  return (
    <>
      <div className="toolbar">
        <p className="muted" style={{ margin: 0 }}>When someone finishes a course it waits here. Open it to see their answers and files, then confirm it.</p>
        <div className="seg" role="group" aria-label="Filter">
          <button className={filter === "awaiting" ? "on" : ""} onClick={() => setFilter("awaiting")}>Awaiting confirmation</button>
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All submissions</button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Person</th><th>Course</th><th>Submitted</th><th>Score</th><th>Time spent</th><th>Extras</th><th>Status</th><th /></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={8} className="muted center">{filter === "awaiting" ? "Nothing is waiting for you. " : "No submissions yet."}</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{name(r.userId)}</td>
                <td>{title(r.courseId)}</td>
                <td>{when(r.completedAt)}</td>
                <td>{r.total > 0 ? `${r.score} / ${r.total}` : "—"}</td>
                <td>{r.timeSpentSec ? fmtMinutes(r.timeSpentSec) : "—"}</td>
                <td>
                  {r.fileCount > 0 && <span className="chip">{r.fileCount}</span>}{" "}
                  {r.responseCount > 0 && <span className="chip">{r.responseCount}</span>}
                  {r.fileCount === 0 && r.responseCount === 0 && <span className="muted">—</span>}
                </td>
                <td>{!r.passed ? <Pill tone="red">Not passed</Pill> : r.confirmedAt ? <Pill tone="green">Confirmed</Pill> : <Pill tone="amber">Awaiting confirmation</Pill>}</td>
                <td className="right">
                  <button className="btn btn-outline btn-sm" onClick={() => setOpen(r.id)}>View</button>{" "}
                  {r.passed && !r.confirmedAt && <button className="btn btn-green btn-sm" onClick={() => quickConfirm(r.id)}>✓ Confirm</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <SubmissionModal id={open} onClose={() => { setOpen(null); void load(); onChanged?.() }} />}
    </>
  )
}

type Detail = {
  completion: CompletionSummary & { answers: Record<string, number[]>; responses: Record<string, string>; files: { blockId: string; name: string; size: number }[]; confirmedBy: string | null }
  user: Person | null
  course: Course | null
  confirmedByName: string
}

export function SubmissionModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState("")
  const load = useCallback(() => api<Detail>(`/api/submissions/${id}`).then(setD).catch((e) => setError(e.message)), [id])
  const dialogRef = useModal<HTMLDivElement>(onClose)
  useEffect(() => { void load() }, [load])

  async function act(action: "confirm" | "unconfirm") {
    setError("")
    try { await api(`/api/submissions/${id}`, send("PATCH", { action })); await load() } catch (e) { setError((e as Error).message) }
  }

  const c = d?.completion
  const blocks = d?.course?.pages.flatMap((p) => p.blocks.map((b) => ({ b, page: p.title }))) ?? []

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sub-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <h2 id="sub-title">{d?.user?.name ?? "Submission"}: {d?.course?.title ?? ""}</h2>
        {error && <p className="form-error">{error}</p>}
        {!d && !error && <p className="muted">Loading...</p>}
        {d && c && (
          <>
            <div className="sub-sec">
              <div className="kv">
                <div><span>Submitted</span>{when(c.completedAt)}</div>
                <div><span>Score</span>{c.total > 0 ? `${c.score} / ${c.total}` : "No quiz"}</div>
                <div><span>Time spent</span>{c.timeSpentSec ? fmtMinutes(c.timeSpentSec) : "—"}</div>
                <div><span>Status</span>{!c.passed ? <Pill tone="red">Not passed</Pill> : c.confirmedAt ? <Pill tone="green">Confirmed</Pill> : <Pill tone="amber">Awaiting confirmation</Pill>}</div>
                {c.confirmedAt && <div><span>Confirmed</span>{when(c.confirmedAt)}{d.confirmedByName ? ` by ${d.confirmedByName}` : ""}</div>}
              </div>
            </div>

            {blocks.map(({ b, page }) => {
              if (b.type === "quiz") {
                return (
                  <div key={b.id} className="sub-sec">
                    <h3> {b.title || "Quiz"}{page ? <span className="muted"> · {page}</span> : null}</h3>
                    {b.questions.map((q, qi) => {
                      const given = c.answers[q.id] ?? []
                      const ok = given.length === q.correct.length && given.every((n, i) => n === [...q.correct].sort((x, y) => x - y)[i])
                      return (
                        <div key={q.id} className={`sub-q ${ok ? "ok" : "bad"}`}>
                          <strong>{qi + 1}. {q.question}</strong>
                          <span className="a">Their answer: {given.length ? given.map((n) => q.options[n]).join("; ") : <em>no answer</em>} {ok ? "✓" : "✗"}</span>
                          {!ok && <span className="a muted">Correct: {q.correct.map((n) => q.options[n]).join("; ")}</span>}
                        </div>
                      )
                    })}
                  </div>
                )
              }
              if (b.type === "response" && c.responses[b.id] !== undefined) {
                return <div key={b.id} className="sub-sec"><h3> {b.prompt || "Written answer"}</h3><div className="sub-resp">{c.responses[b.id]}</div></div>
              }
              if (b.type === "upload") {
                const f = c.files.find((x) => x.blockId === b.id)
                return (
                  <div key={b.id} className="sub-sec">
                    <h3> {b.prompt || "Uploaded file"}</h3>
                    {f ? (
                      <div className="file-card"><span className="nm">{f.name}</span><span className="sz">{fmtSize(f.size)}</span><a className="btn btn-green btn-sm" href={`/api/submissions/${id}/files/${f.blockId}`}>⬇ Download</a></div>
                    ) : <span className="muted">No file.</span>}
                  </div>
                )
              }
              return null
            })}
            {!d.course && <p className="muted">The course was deleted, so the questions can&apos;t be shown.</p>}
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          {c?.passed && (c.confirmedAt
            ? <button className="btn btn-danger" onClick={() => act("unconfirm")}>Remove confirmation</button>
            : <button className="btn btn-green" onClick={() => act("confirm")}>✓ Confirm completion</button>)}
        </div>
      </div>
    </div>
  )
}
