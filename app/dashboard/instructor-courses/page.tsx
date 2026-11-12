"use client"

import { useCallback, useEffect, useState } from "react"
import CoursesList from "@/components/CoursesList"
import LearnerCourses from "@/components/LearnerCourses"
import ProgressPanel from "@/components/ProgressPanel"
import SubmissionsPanel from "@/components/SubmissionsPanel"
import { api } from "@/lib/client"
import { CompletionSummary, PublicAccount } from "@/lib/types"

type Tab = "courses" | "submissions" | "progress"

export default function InstructorCourses() {
  const [me, setMe] = useState<PublicAccount | null>(null)
  const [tab, setTab] = useState<Tab>("courses")
  const [awaiting, setAwaiting] = useState(0)

  const countAwaiting = useCallback(() =>
    api<CompletionSummary[]>("/api/completions").then((c) => setAwaiting(c.filter((x) => x.passed && !x.confirmedAt).length)).catch(() => {}), [])

  useEffect(() => {
    api<PublicAccount>("/api/me").then((m) => { setMe(m); if (m.role === "Admin") void countAwaiting() }).catch(() => {})
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t === "submissions" || t === "progress") setTab(t)
  }, [countAwaiting])

  if (!me) return <main className="dash-main"><p className="muted">Loading...</p></main>

  const isAdmin = me.role === "Admin"
  return (
    <main className="dash-main wide">
      <div className="page-title">
        <div>
          <h1>Instructor Courses</h1>
          <p>{isAdmin ? "Build courses, review submissions and keep track of everyone's progress." : "Your training courses. Finish them to be ready for class."}</p>
        </div>
      </div>

      {isAdmin ? (
        <>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "courses"} className={`tab${tab === "courses" ? " active" : ""}`} onClick={() => setTab("courses")}> Courses</button>
            <button role="tab" aria-selected={tab === "submissions"} className={`tab${tab === "submissions" ? " active" : ""}`} onClick={() => setTab("submissions")}>
               Submissions {awaiting > 0 && <span className="count-dot" aria-label={`${awaiting} awaiting`}>{awaiting}</span>}
            </button>
            <button role="tab" aria-selected={tab === "progress"} className={`tab${tab === "progress" ? " active" : ""}`} onClick={() => setTab("progress")}> Progress &amp; Redo</button>
          </div>
          {tab === "courses" && <CoursesList />}
          {tab === "submissions" && <SubmissionsPanel onChanged={countAwaiting} />}
          {tab === "progress" && <ProgressPanel />}
        </>
      ) : (
        <div style={{ maxWidth: "64rem" }}><LearnerCourses /></div>
      )}
    </main>
  )
}
