"use client"

import { useEffect, useState } from "react"
import { useModal } from "@/lib/useModal"
import { SubmissionModal } from "@/components/SubmissionsPanel"
import { StatusPill } from "@/components/StatusPill"
import { api, send } from "@/lib/client"
import { courseStatus } from "@/lib/status"
import { CompletionSummary, Redo } from "@/lib/types"

type CourseSummary = { id: string; title: string; published: boolean; roles: string[]; assignedTo: string[] }

export default function PersonCoursesModal({ person, onClose, onChanged }: { person: { id: string; name: string; role?: string }; onClose: () => void; onChanged?: () => void }) {
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [done, setDone] = useState<CompletionSummary[]>([])
  const [redos, setRedos] = useState<Redo[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [viewing, setViewing] = useState<string | null>(null)

  const load = () =>
    Promise.all([api<CourseSummary[]>("/api/courses"), api<CompletionSummary[]>("/api/completions"), api<Redo[]>("/api/redos")])
      .then(([c, d, r]) => { setCourses(c); setDone(d.filter((x) => x.userId === person.id)); setRedos(r.filter((x) => x.userId === person.id)) })
      .catch((e) => setError(e.message))
  const dialogRef = useModal<HTMLDivElement>(onClose)
  useEffect(() => { load() }, [])

  async function setRedo(courseId: string, redo: boolean) {
    setError("")
    try { await api("/api/redos", send("POST", { userId: person.id, courseId, redo, note: notes[courseId] ?? "" })); await load(); onChanged?.() }
    catch (e) { setError((e as Error).message) }
  }
  async function assign(courseId: string, assigned: boolean) {
    setError("")
    try { await api("/api/assignments", send("POST", { userId: person.id, courseId, assigned })); await load(); onChanged?.() }
    catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="pc-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <h2 id="pc-title">{person.name}: courses</h2>
        <p className="muted" style={{ margin: 0 }}><strong>Assign</strong> a course to just this person, or mark it <strong>Redo</strong> to ask them to take it again. A Redo is only a label: nothing is removed, and it clears when they pass the course again.</p>
        {error && <p className="form-error">{error}</p>}
        {courses.length === 0 && <p className="muted">No courses yet.</p>}
        {courses.map((c) => {
          const redo = redos.find((r) => r.courseId === c.id)
          const status = courseStatus(done, c.id, !!redo)
          const direct = c.assignedTo.includes(person.id)
          const viaRole = !!person.role && c.roles.includes(person.role)
          const latest = done.filter((d) => d.courseId === c.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
          return (
            <div key={c.id} className="q-card">
              <div className="blk-head" style={{ marginBottom: 0 }}>
                <strong style={{ fontSize: ".95rem" }}>{c.title}{!c.published && <span className="muted"> (draft)</span>}</strong>
                <StatusPill status={status} />
              </div>
              <div className="chips">
                {direct && <span className="chip blue">Assigned to {person.name.split(" ")[0]}</span>}
                {viaRole && <span className="chip blue">Required for role: {person.role}</span>}
                {!direct && !viaRole && c.roles.length === 0 && c.assignedTo.length === 0 && <span className="chip">Open to everyone</span>}
              </div>
              {redo?.note && <span className="muted" style={{ fontSize: ".85rem" }}>Note: {redo.note}</span>}
              <div className="btn-row">
                {direct
                  ? <button className="btn btn-outline btn-sm" onClick={() => assign(c.id, false)}>Remove assignment</button>
                  : <button className="btn btn-blue btn-sm" onClick={() => assign(c.id, true)}>＋ Assign to {person.name.split(" ")[0]}</button>}
                {latest && <button className="btn btn-outline btn-sm" onClick={() => setViewing(latest.id)}>View submission</button>}
                {redo
                  ? <button className="btn btn-outline btn-sm" onClick={() => setRedo(c.id, false)}>Clear Redo</button>
                  : (
                    <>
                      <input className="input" style={{ flex: 1, minWidth: "9rem", minHeight: "2.05rem", padding: ".2rem .6rem" }} placeholder="Redo note (optional)" value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                      <button className="btn btn-outline btn-sm" onClick={() => setRedo(c.id, true)}>Mark Redo</button>
                    </>
                  )}
              </div>
            </div>
          )
        })}
        <div className="modal-actions"><button className="btn btn-outline" onClick={onClose}>Close</button></div>
      </div>
      {viewing && <div onClick={(e) => e.stopPropagation()}><SubmissionModal id={viewing} onClose={() => { setViewing(null); void load() }} /></div>}
    </div>
  )
}
