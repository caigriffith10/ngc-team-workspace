"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { StatusPill } from "@/components/StatusPill"
import { api } from "@/lib/client"
import { courseStatus } from "@/lib/status"
import { CompletionSummary, Redo, programName } from "@/lib/types"

type Summary = { id: string; title: string; type: string; program: string; description: string; minMinutes: number | null; pageCount: number; quizQuestions: number; required: boolean }

export default function LearnerCourses() {
  const [courses, setCourses] = useState<Summary[] | null>(null)
  const [done, setDone] = useState<CompletionSummary[]>([])
  const [redos, setRedos] = useState<Redo[]>([])

  useEffect(() => {
    Promise.all([api<Summary[]>("/api/courses"), api<CompletionSummary[]>("/api/completions"), api<Redo[]>("/api/redos")])
      .then(([c, d, r]) => { setCourses(c); setDone(d); setRedos(r) })
      .catch(() => setCourses([]))
  }, [])

  if (!courses) return <p className="muted">Loading...</p>
  const sorted = [...courses].sort((a, b) => Number(b.required) - Number(a.required))

  return (
    <div className="course-list">
      {sorted.length === 0 && <div className="panel course-row muted">No courses have been assigned yet.</div>}
      {sorted.map((c) => {
        const redo = redos.find((r) => r.courseId === c.id)
        const status = courseStatus(done, c.id, !!redo)
        const label = status === "redo" ? "Redo" : status === "todo" ? "Start" : status === "notpassed" ? "Try again" : "Review"
        return (
          <div key={c.id} className={`panel course-row${c.required ? " required" : ""}`}>
            <div className="info">
              <h3>{c.title}</h3>
              <div className="chips">
                <StatusPill status={status} />
                {c.required ? <span className="chip blue">Required</span> : <span className="chip">Optional</span>}
                {c.program && <span className="chip purple">{programName(c.program)}</span>}
                {c.minMinutes ? <span className="chip">Min {c.minMinutes} min</span> : null}
              </div>
              {c.description && <p>{c.description}</p>}
              {redo?.note && <p>Note from admin: {redo.note}</p>}
              {status === "awaiting" && <p>You finished this one. An admin will confirm it soon.</p>}
            </div>
            <div className="actions">
              <Link href={`/dashboard/courses/${c.id}`} className="btn btn-green btn-sm">{label}</Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
