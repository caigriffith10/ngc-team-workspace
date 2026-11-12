"use client"

import { useEffect, useMemo, useState } from "react"
import ScheduleEditor from "@/components/ScheduleEditor"
import { Pill } from "@/components/StatusPill"
import { api } from "@/lib/client"
import { ABSENT_FORM_URL } from "@/lib/contact"
import { PublicAccount, ScheduleDay } from "@/lib/types"

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

const dateParts = (iso: string) => {
  const d = new Date(iso + "T12:00:00")
  return { wd: d.toLocaleDateString([], { weekday: "short" }), mo: d.toLocaleDateString([], { month: "short" }), day: d.getDate() }
}
const fmt12 = (t: string) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` }
const timeRange = (d: ScheduleDay) => (d.startTime ? `${fmt12(d.startTime)}${d.endTime ? ` to ${fmt12(d.endTime)}` : ""}` : "")

export default function SchedulePage() {
  const [me, setMe] = useState<PublicAccount | null>(null)
  const [days, setDays] = useState<ScheduleDay[] | null>(null)
  const [tab, setTab] = useState<"schedule" | "edit">("schedule")
  const [showPast, setShowPast] = useState(false)
  const [error, setError] = useState("")
  const today = todayET()

  useEffect(() => {
    ;(async () => {
      setMe(await api<PublicAccount>("/api/me"))
      setDays(await api<ScheduleDay[]>("/api/schedule"))
    })().catch((e) => setError(e.message))
  }, [])

  const upcoming = useMemo(() => (days ?? []).filter((d) => d.date >= today), [days, today])
  const past = useMemo(() => (days ?? []).filter((d) => d.date < today).reverse(), [days, today])

  if (!me || !days) return <main className="dash-main"><p className="muted">{error || "Loading..."}</p></main>
  const isAdmin = me.role === "Admin"

  // Attendance itself is handled by the links, so this page only shows the days and sends people to the absence link.
  const row = (d: ScheduleDay, locked: boolean) => {
    const p = dateParts(d.date)
    const isToday = d.date === today
    return (
      <div key={d.id} className={`sched-row${isToday ? " is-today" : ""}`}>
        <div className="sched-date"><span>{p.wd}</span><strong>{p.day}</strong><span>{p.mo}</span></div>
        <div className="sched-main">
          <div className="sched-title">
            <strong>{d.title || "Class day"}</strong>
            {isToday && <Pill tone="blue">Today</Pill>}
          </div>
          <p className="muted sched-meta">{[timeRange(d), d.location].filter(Boolean).join(" · ") || "Time and place to be announced"}</p>
          {d.notes && <p className="sched-notes">{d.notes}</p>}
          {!locked && (
            <div className="sched-actions">
              <a className="btn btn-danger btn-sm" href={ABSENT_FORM_URL} target="_blank" rel="noopener noreferrer">Mark absent</a>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className={`dash-main${tab === "edit" ? " wide" : ""}`}>
      <div className="page-title">
        <div>
          <h1>Schedule</h1>
          <p>Every class day. Can&apos;t make one? Use Mark absent.</p>
        </div>
        <a className="btn btn-danger" href={ABSENT_FORM_URL} target="_blank" rel="noopener noreferrer">Mark Absent</a>
      </div>

      {isAdmin && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "schedule"} className={`tab${tab === "schedule" ? " active" : ""}`} onClick={() => setTab("schedule")}>Schedule</button>
          <button role="tab" aria-selected={tab === "edit"} className={`tab${tab === "edit" ? " active" : ""}`} onClick={() => setTab("edit")}>Edit schedule</button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      {tab === "edit" && isAdmin ? (
        <ScheduleEditor days={days} onSaved={(d) => setDays(d)} />
      ) : (
        <>
          {days.length === 0 && (
            <div className="panel card-pad" style={{ padding: "2rem", textAlign: "center", alignItems: "center" }}>
              <strong>No days on the schedule yet</strong>
              <span className="muted">{isAdmin ? "Open “Edit schedule” to add days or import them from Claude." : "An admin will add the class days soon."}</span>
            </div>
          )}
          <div className="sched-list">{upcoming.map((d) => row(d, false))}</div>
          {days.length > 0 && upcoming.length === 0 && <p className="muted">No upcoming days.</p>}
          {past.length > 0 && (
            <>
              <button className="btn btn-outline btn-sm" style={{ marginTop: "1.5rem" }} onClick={() => setShowPast(!showPast)}>{showPast ? "Hide" : "Show"} past days ({past.length})</button>
              {showPast && <div className="sched-list" style={{ marginTop: ".75rem" }}>{past.map((d) => row(d, true))}</div>}
            </>
          )}
        </>
      )}
    </main>
  )
}
