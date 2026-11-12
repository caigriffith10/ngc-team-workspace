"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/client"
import { ABSENT_FORM_URL, SIGN_IN_URL, STUDENT_LINK_LABEL } from "@/lib/contact"
import { courseStatus } from "@/lib/status"
import { CompletionSummary, Me, Redo, ScheduleDay } from "@/lib/types"

type Summary = { id: string; title: string; published: boolean; required?: boolean }

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}
const longDate = () => new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
const fmtDay = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000)
const when = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`)

export default function DashboardHome() {
  const [me, setMe] = useState<Me | null>(null)
  const [courses, setCourses] = useState<Summary[]>([])
  const [done, setDone] = useState<CompletionSummary[]>([])
  const [redos, setRedos] = useState<Redo[]>([])
  const [schedule, setSchedule] = useState<ScheduleDay[]>([])

  useEffect(() => {
    ;(async () => {
      const m = await api<Me>("/api/me")
      setMe(m)
      const [c, d, r, sch] = await Promise.all([
        api<Summary[]>("/api/courses"), api<CompletionSummary[]>("/api/completions"), api<Redo[]>("/api/redos"), api<ScheduleDay[]>("/api/schedule"),
      ])
      setCourses(c); setDone(d); setRedos(r); setSchedule(sch)
    })().catch(() => {})
  }, [])

  const today = todayET()
  const first = (me?.name ?? "").trim().split(/\s+/)[0] || "there"
  const isAdmin = me?.role === "Admin"
  const coming = schedule.filter((d) => d.date >= today).slice(0, 4)
  const nextDay = coming[0]

  const my = useMemo(() => {
    const redoIds = new Set(redos.map((r) => r.courseId))
    const rows = courses.map((c) => ({ ...c, status: courseStatus(done, c.id, redoIds.has(c.id)) }))
    const completed = rows.filter((r) => r.status === "completed").length
    const awaiting = rows.filter((r) => r.status === "awaiting").length
    const todo = rows.filter((r) => r.status === "todo" || r.status === "notpassed" || r.status === "redo").sort((a, b) => Number(!!b.required) - Number(!!a.required))
    return { total: rows.length, completed, awaiting, next: todo[0] }
  }, [courses, done, redos])
  const pct = my.total ? Math.round((my.completed / my.total) * 100) : 0

  if (!me) return <main className="dash-main"><p className="muted">Loading...</p></main>

  type L = { href: string; title: string; text: string; external?: boolean }
  // Settings is always the last block. A standard user gets exactly six.
  const blocks: L[] = [
    { href: "/dashboard/instructor-courses", title: "Instructor Courses", text: isAdmin ? "Build courses, review submissions" : "Your training and quizzes" },
    { href: "/dashboard/program-guides", title: "Program Guides", text: "Python, JavaScript, CSP, Scratch" },
    { href: "/dashboard/schedule", title: "Schedule", text: isAdmin ? "Build the class schedule" : "Every class day" },
    ...(isAdmin ? [{ href: "/dashboard/accounts", title: "Accounts", text: "Logins and roles" }, { href: "/dashboard/roles", title: "Roles", text: "Make roles and set what they can do" }, { href: "/dashboard/class-email", title: "Send Class Email", text: "One message to everyone" }] : []),
    ...(me.permissions.includes("viewAttendance") ? [{ href: "https://www.google.com", title: "Instructor Attendance", text: "View all instructor attendances", external: true }] : []),
    ...(!isAdmin ? [{ href: ABSENT_FORM_URL, title: "Mark Absent", text: "Can't make a class? Tell us here", external: true }] : []),
    { href: SIGN_IN_URL, title: STUDENT_LINK_LABEL, text: "For parents to sign students in", external: true },
    { href: "/dashboard/settings", title: "Settings", text: "Your name, password and look" },
  ]

  return (
    <main className="dash-main">
      <header className="home-head">
        <p className="eyebrow">{longDate()}{nextDay ? ` · next class ${when(daysBetween(today, nextDay.date))}` : ""}</p>
        <h1>{greeting()}, {first}.</h1>
        <span className="role-tag">{me.role}</span>
      </header>

      <section aria-label="Coming up">
        <h2 className="label-caps">Coming up</h2>
        {coming.length === 0 ? (
          <div className="empty-note">
            <span>No class days on the schedule yet.</span>
            {isAdmin && <Link href="/dashboard/schedule" className="btn btn-outline btn-sm">Build the schedule</Link>}
          </div>
        ) : (
          <div className="days">
            {coming.map((d, i) => {
              const dt = new Date(d.date + "T12:00:00")
              return (
                <Link key={d.id} href="/dashboard/schedule" className={`day${i === 0 ? " first" : ""}`}>
                  <span className="day-wd">{dt.toLocaleDateString([], { weekday: "short" })}</span>
                  <span className="day-n">{dt.getDate()}</span>
                  <span className="day-mo">{dt.toLocaleDateString([], { month: "short" })}</span>
                  <span className="day-t">{d.title || "Class day"}</span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {!isAdmin && (
        <div className="split" style={{ marginTop: "1.5rem" }}>
          <section>
            <h2>Your training</h2>
            {my.total === 0 ? <p className="muted">No courses assigned yet.</p> : (
              <>
                <p><strong>{my.completed}</strong> of {my.total} complete{my.awaiting > 0 ? `, ${my.awaiting} awaiting confirmation` : ""}</p>
                <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>
              </>
            )}
            {my.next ? (
              <p style={{ marginTop: "1rem" }}>
                Next: <Link href={`/dashboard/courses/${my.next.id}`}>{my.next.title}</Link>{my.next.status === "redo" ? " (redo requested)" : ""}
              </p>
            ) : my.total > 0 && my.awaiting === 0 ? <p style={{ marginTop: "1rem" }}>You&apos;re all caught up.</p> : null}
          </section>
          <section>
            <h2>Next class</h2>
            {nextDay ? (
              <>
                <p><strong>{nextDay.title || "Class day"}</strong></p>
                <p className="muted">{fmtDay(nextDay.date)}{nextDay.location ? ` · ${nextDay.location}` : ""}</p>
                <div className="btn-row" style={{ marginTop: ".75rem" }}>
                  <Link href="/dashboard/schedule" className="btn btn-outline btn-sm">Open schedule</Link>
                  <a href={ABSENT_FORM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-danger btn-sm">Mark absent</a>
                </div>
              </>
            ) : <p className="muted">No upcoming days on the schedule.</p>}
          </section>
        </div>
      )}

      <h2 className="label-caps" style={{ marginTop: "2rem" }}>Go to</h2>
      <div className="blocks3">
        {blocks.map((l) => {
          const inner = <><strong>{l.title}</strong><span className="muted">{l.text}</span><span className="arrow" aria-hidden="true">{l.external ? "↗" : "→"}</span></>
          return l.external
            ? <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="block3">{inner}</a>
            : <Link key={l.href} href={l.href} className="block3">{inner}</Link>
        })}
      </div>
    </main>
  )
}
