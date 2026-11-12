"use client"

import { useCallback, useEffect, useState } from "react"
import PersonCoursesModal from "@/components/PersonCoursesModal"
import { Pill } from "@/components/StatusPill"
import { api } from "@/lib/client"
import { courseStatus, isVisibleTo } from "@/lib/status"
import { CompletionSummary, Redo, Role } from "@/lib/types"

type Person = { id: string; name: string; role: string }
type CourseLite = { id: string; title: string; published: boolean; roles: Role[]; assignedTo: string[] }

export default function ProgressPanel() {
  const [people, setPeople] = useState<Person[]>([])
  const [courses, setCourses] = useState<CourseLite[]>([])
  const [done, setDone] = useState<CompletionSummary[]>([])
  const [redos, setRedos] = useState<Redo[]>([])
  const [open, setOpen] = useState<Person | null>(null)

  const load = useCallback(() =>
    Promise.all([api<Person[]>("/api/people"), api<CourseLite[]>("/api/courses"), api<CompletionSummary[]>("/api/completions"), api<Redo[]>("/api/redos")])
      .then(([p, c, d, r]) => { setPeople(p); setCourses(c.filter((x) => x.published)); setDone(d); setRedos(r) })
      .catch(() => {}), [])
  useEffect(() => { load() }, [load])

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>Each person&apos;s courses are the published ones assigned to their role or to them (or open to everyone). Open <strong>Manage</strong> to assign a course to one person or ask for a Redo.</p>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Confirmed</th><th>Awaiting</th><th>Redo</th><th /></tr></thead>
          <tbody>
            {people.length === 0 && <tr><td colSpan={6} className="muted center">No volunteers yet.</td></tr>}
            {people.map((p) => {
              const mine = courses.filter((c) => isVisibleTo(c, p))
              const list = done.filter((d) => d.userId === p.id)
              const redoIds = new Set(redos.filter((x) => x.userId === p.id).map((x) => x.courseId))
              const statuses = mine.map((c) => courseStatus(list, c.id, redoIds.has(c.id)))
              const completed = statuses.filter((s) => s === "completed").length
              const awaiting = statuses.filter((s) => s === "awaiting").length
              const redo = statuses.filter((s) => s === "redo").length
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><span className="chip">{p.role}</span></td>
                  <td>{completed} of {mine.length}</td>
                  <td>{awaiting > 0 ? <Pill tone="amber">{awaiting} awaiting</Pill> : <span className="muted">—</span>}</td>
                  <td>{redo > 0 ? <Pill tone="orange">{redo} redo</Pill> : <span className="muted">—</span>}</td>
                  <td className="right"><button className="btn btn-outline btn-sm" onClick={() => setOpen(p)}>Manage</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {open && <PersonCoursesModal person={open} onClose={() => { setOpen(null); load() }} onChanged={load} />}
    </>
  )
}
