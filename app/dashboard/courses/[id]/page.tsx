"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Answers, BlockView, LearnerState, Responses, Uploads, missingItems } from "@/components/CourseBlocks"
import { api, send } from "@/lib/client"
import { fmtMinutes } from "@/lib/status"
import { Course, PublicAccount } from "@/lib/types"

type LearnCourse = Course & { startToken: string; required: boolean }
type Result = { score: number; total: number; passed: boolean; results: Record<string, boolean>; passPercent: number; awaiting: boolean }

export default function CoursePlayer() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<LearnCourse | null>(null)
  const [me, setMe] = useState<PublicAccount | null>(null)
  const [error, setError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [page, setPage] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [responses, setResponses] = useState<Responses>({})
  const [uploads, setUploads] = useState<Uploads>({})
  const [result, setResult] = useState<Result | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setPage(0); setAnswers({}); setResponses({}); setUploads({}); setResult(null); setElapsed(0); setSubmitError("")
    return api<LearnCourse>(`/api/courses/${id}?view=learn`).then(setCourse).catch((e) => setError(e.message))
  }, [id])

  useEffect(() => {
    api<PublicAccount>("/api/me").then(setMe).catch(() => {})
    void load()
  }, [load])

  // Time on the course. The server checks the real time again when you submit.
  useEffect(() => {
    if (!course || result) return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [course, result])

  const st: LearnerState = useMemo(() => ({ answers, setAnswers, responses, setResponses, uploads, setUploads }), [answers, responses, uploads])
  const isAdmin = me?.role === "Admin"

  async function submit() {
    if (!course || busy) return
    setBusy(true); setSubmitError("")
    try {
      setResult(await api<Result>(`/api/courses/${id}/submit`, send("POST", { answers, responses, uploads, startToken: course.startToken })))
    } catch (e) { setSubmitError((e as Error).message) } finally { setBusy(false) }
  }

  const back = isAdmin ? (
    <div className="admin-bar">
      <span> Preview mode: nothing here is saved or counted.</span>
      <div className="btn-row">
        <Link href={`/dashboard/courses/${id}/edit`} className="btn btn-green btn-sm">← Back to editor</Link>
        <Link href="/dashboard/instructor-courses" className="btn btn-outline btn-sm">Instructor Courses</Link>
      </div>
    </div>
  ) : null

  if (error) return <main className="dash-main"><p className="form-error">{error}</p><Link href="/dashboard/instructor-courses" className="btn-back">← Back to courses</Link></main>
  if (!course) return <main className="dash-main"><p className="muted">Loading...</p></main>

  const allBlocks = course.pages.flatMap((p) => p.blocks)
  const questions = allBlocks.flatMap((b) => (b.type === "quiz" ? b.questions : []))
  const isLast = page === course.pages.length - 1
  const current = course.pages[page]

  if (result) {
    return (
      <>
        {back}
        <main className="dash-main">
          <div className="player">
            <div className="panel result">
              {result.total > 0 && <div className="big">{result.score} / {result.total}</div>}
              {result.passed ? (
                <>
                  <h2 style={{ margin: 0 }}>{isAdmin ? "Course complete (preview)" : "Submitted!"}</h2>
                  {!isAdmin && <span className="pill amber">Awaiting confirmation</span>}
                  {!isAdmin && <p className="muted" style={{ margin: 0 }}>An admin will review your work and confirm your completion.</p>}
                </>
              ) : (
                <>
                  <h2 style={{ margin: 0 }}>Not passed yet</h2>
                  <p className="muted" style={{ margin: 0 }}>You need {result.passPercent}% to pass. Review and try again.</p>
                </>
              )}
            </div>
            {questions.length > 0 && (
              <div className="panel page-card" style={{ marginTop: "1rem" }}>
                <h3 style={{ margin: 0 }}>Review</h3>
                {questions.map((q) => <p key={q.id} style={{ margin: 0 }}>{result.results[q.id] ? "✓ Correct:" : "✗ Missed:"} {q.question}</p>)}
              </div>
            )}
            <div className="player-nav">
              <Link href={isAdmin ? `/dashboard/courses/${id}/edit` : "/dashboard/instructor-courses"} className="btn btn-outline">{isAdmin ? "← Back to editor" : "Back to courses"}</Link>
              {!result.passed && <button className="btn btn-green" onClick={() => void load()}>Try again</button>}
            </div>
          </div>
        </main>
      </>
    )
  }

  const minSec = course.minMinutes ? course.minMinutes * 60 : 0
  const waitSec = isAdmin ? 0 : Math.max(0, minSec - elapsed)
  const todo = missingItems(allBlocks, st)
  const canSubmit = waitSec === 0 && todo.length === 0 && !busy

  return (
    <>
      {back}
      <main className="dash-main">
        <div className="player">
          <div className="player-bar">
            <div>
              <strong>{course.title}</strong>
              <div className="muted" style={{ fontSize: ".85rem" }}>Page {page + 1} of {course.pages.length}{course.required && " · Required"}</div>
            </div>
            {minSec > 0 && (
              <span className={`timer${waitSec === 0 ? " done" : ""}`}>
                {waitSec === 0 ? "Minimum time reached ✓" : `Submit unlocks in ${fmtMinutes(waitSec)}`}
                {isAdmin && ` (learners: ${course.minMinutes} min minimum)`}
              </span>
            )}
          </div>
          <div className="progress"><div style={{ width: `${((page + 1) / course.pages.length) * 100}%` }} /></div>

          <div className="panel page-card">
            {current.title && <h2 className="page-h">{current.title}</h2>}
            {current.blocks.length === 0 && <p className="muted">This page is empty.</p>}
            {current.blocks.map((b) => <BlockView key={b.id} block={b} st={st} />)}
          </div>

          {isLast && (todo.length > 0 || waitSec > 0) && (
            <div className="notice warn" style={{ marginTop: "1rem", marginBottom: 0 }}>
              <strong>Before you can submit:</strong>
              <ul style={{ margin: ".3rem 0 0", paddingLeft: "1.2rem" }}>
                {waitSec > 0 && <li>Spend at least {course.minMinutes} minutes on this course ({fmtMinutes(waitSec)} left).</li>}
                {todo.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
          {submitError && <p className="form-error" style={{ marginTop: ".75rem" }}>{submitError}</p>}

          <div className="player-nav">
            <button className="btn btn-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
            {isLast ? (
              <button className="btn btn-green" disabled={!canSubmit} onClick={submit}>{busy ? "Submitting..." : "Submit course"}</button>
            ) : (
              <button className="btn btn-green" onClick={() => setPage(page + 1)}>Next →</button>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
