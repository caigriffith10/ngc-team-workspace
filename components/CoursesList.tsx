"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import ImportModal from "@/components/ImportModal"
import { PublishPill } from "@/components/StatusPill"
import { api, send } from "@/lib/client"
import { Course, programName } from "@/lib/types"

type Summary = {
  id: string; title: string; type: string; program: string; minMinutes: number | null; published: boolean
  pageCount: number; quizQuestions: number; roles: string[]; assignedTo: string[]
}

export default function CoursesList() {
  const router = useRouter()
  const [courses, setCourses] = useState<Summary[] | null>(null)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  const load = () => api<Summary[]>("/api/courses").then(setCourses).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function create(lesson?: { title: string; description: string; pages: Course["pages"] }) {
    setCreating(true)
    setError("")
    try {
      const { id } = await api<{ id: string }>("/api/courses", send("POST"))
      if (lesson) {
        const fresh = await api<Course>(`/api/courses/${id}`)
        await api(`/api/courses/${id}`, send("PUT", { ...fresh, title: lesson.title || fresh.title, description: lesson.description, pages: lesson.pages }))
      }
      router.push(`/dashboard/courses/${id}/edit`)
    } catch (e) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  async function setPublished(c: Summary, published: boolean) {
    setError("")
    try { await api(`/api/courses/${c.id}`, send("PATCH", { published })); await load() } catch (e) { setError((e as Error).message) }
  }

  async function remove(c: Summary) {
    if (!confirm(`Delete "${c.title}"? This also removes everyone's submissions for it.`)) return
    await api(`/api/courses/${c.id}`, send("DELETE"))
    load()
  }

  const audience = (c: Summary) => {
    if (c.roles.length === 0 && c.assignedTo.length === 0) return <span className="chip">Open to everyone</span>
    return (
      <>
        {c.roles.map((r) => <span key={r} className="chip blue">Required: {r}</span>)}
        {c.assignedTo.length > 0 && <span className="chip blue">+ {c.assignedTo.length} assigned {c.assignedTo.length === 1 ? "person" : "people"}</span>}
      </>
    )
  }

  return (
    <div>
      <div className="toolbar">
        <p style={{ margin: 0 }} className="muted">Build a course, choose who takes it, then publish it.</p>
        <div className="btn-row">
          <button className="btn btn-outline" onClick={() => setImporting(true)} disabled={creating}>✨ Import lesson from Claude</button>
          <button className="btn btn-green" onClick={() => create()} disabled={creating}>{creating ? "Creating..." : "＋ Create course"}</button>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="course-list">
        {courses?.length === 0 && <div className="panel course-row muted">No courses yet. Click “Create course” to start.</div>}
        {courses?.map((c) => (
          <div key={c.id} className={`panel course-row${c.published ? " published" : ""}`}>
            <div className="info">
              <h3>{c.title}</h3>
              <div className="chips">
                <PublishPill published={c.published} />
                {c.program && <span className="chip purple">{programName(c.program)}</span>}
                {c.type && <span className="chip">{c.type}</span>}
                {audience(c)}
              </div>
              <p>
                {c.pageCount} page{c.pageCount === 1 ? "" : "s"}
                {c.quizQuestions ? <> · {c.quizQuestions} quiz question{c.quizQuestions === 1 ? "" : "s"}</> : null}
                {c.minMinutes ? <> · min {c.minMinutes} min</> : null}
              </p>
            </div>
            <div className="actions">
              {c.published
                ? <button className="btn btn-outline btn-sm" onClick={() => setPublished(c, false)}>Unpublish</button>
                : <button className="btn btn-green btn-sm" onClick={() => setPublished(c, true)}>Publish course</button>}
              <Link href={`/dashboard/courses/${c.id}/edit`} className="btn btn-blue btn-sm">✏️ Edit</Link>
              <Link href={`/dashboard/courses/${c.id}`} className="btn btn-outline btn-sm">👁 Preview</Link>
              <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>🗑 Delete</button>
            </div>
          </div>
        ))}
      </div>

      {importing && <ImportModal kind="lesson" onClose={() => setImporting(false)} onLesson={(l) => { setImporting(false); void create(l) }} />}
    </div>
  )
}
