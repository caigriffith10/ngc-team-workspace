"use client"

import { useModal } from "@/lib/useModal"
import { useState } from "react"
import { markdownToHtml } from "@/lib/sanitize"
import { CoursePage, Question, ScheduleDay, uid } from "@/lib/types"
import { parseLessonImport, parseQuizImport, parseScheduleImport } from "@/lib/validate"

type Lesson = { title: string; description: string; pages: CoursePage[] }

/** Cuts the JSON out of whatever Claude replied with (it may add a sentence or a code fence). */
function extractJson(text: string): unknown {
  const start = text.search(/[{[]/)
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"))
  if (start < 0 || end < start) throw new Error("no json")
  return JSON.parse(text.slice(start, end + 1))
}

export default function ImportModal({ kind, onClose, onLesson, onQuestions, onText, onDays }: {
  kind: "lesson" | "quiz" | "schedule"
  onClose: () => void
  onDays?: (d: ScheduleDay[]) => void
  onLesson?: (l: Lesson) => void
  onQuestions?: (q: Question[]) => void
  /** When set (the Import button inside a text block), plain text or Markdown from Claude is accepted too. */
  onText?: (html: string) => void
}) {
  const dialogRef = useModal<HTMLDivElement>(onClose)
  const [text, setText] = useState("")
  const [err, setErr] = useState("")
  const skill = kind === "lesson" ? "ngc-lesson-builder" : kind === "schedule" ? "ngc-schedule-builder" : "ngc-quiz-builder"
  const skillName = kind === "lesson" ? "NextGen Lesson Builder" : kind === "schedule" ? "NextGen Schedule Builder" : "NextGen Quiz Builder"

  function run() {
    setErr("")
    let data: unknown
    try { data = extractJson(text) } catch {
      if (onText && text.trim()) { onText(markdownToHtml(text)); return }
      setErr("Couldn't read that. Paste exactly what Claude gave you, JSON included.")
      return
    }
    if (kind === "schedule") {
      const parsed = parseScheduleImport(data)
      if ("error" in parsed) { setErr(parsed.error); return }
      onDays?.(parsed.days)
    } else if (kind === "lesson") {
      const parsed = parseLessonImport(data)
      if ("error" in parsed) {
        if (onText && text.trim()) { onText(markdownToHtml(text)); return }
        setErr(parsed.error); return
      }
      onLesson?.(parsed)
    } else {
      const parsed = parseQuizImport(data)
      if ("error" in parsed) { setErr(parsed.error); return }
      onQuestions?.(parsed.questions.map((q) => ({ ...q, id: uid() })))
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="import-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <h2 id="import-title">{kind === "lesson" ? "Import a lesson from Claude" : kind === "schedule" ? "Import a schedule from Claude" : "Import a quiz from Claude"}</h2>
        <ol>
          <li>
            Download the skill: <a href={`/api/skills/${skill}`} download className="btn btn-green btn-sm">⬇ {skillName} skill</a>
          </li>
          <li>In Claude, open Settings, find <strong>Skills</strong>, and upload the zip you just downloaded. You only do this once.</li>
          <li>
            {kind === "lesson"
              ? <>Upload your presentation (.pptx or PDF) or paste your notes into Claude and say: <em>“Use NextGen Lesson Builder to turn this into a lesson for Python.”</em></>
              : kind === "schedule"
                ? <>Paste your dates (a calendar, an email, a list) into Claude and say: <em>“Use NextGen Schedule Builder to make our fall schedule from this.”</em></>
                : <>Paste your course text into Claude and say: <em>“Use NextGen Quiz Builder to make 10 questions from this.”</em></>}
          </li>
          <li>Copy Claude&apos;s answer and paste it here:{onText ? " (plain text or Markdown works too and goes into this text box)" : ""}</li>
        </ol>
        <textarea className="input mono" rows={9} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={kind === "lesson" ? '{"lesson":{"title":"...","pages":[{"title":"...","blocks":[{"type":"text","html":"<p>...</p>"}]}]}}' : kind === "schedule" ? '{"schedule":{"days":[{"date":"2026-11-14","title":"...","startTime":"10:00","endTime":"12:00","location":"","notes":""}]}}' : '{"questions":[{"question":"...","options":["...","..."],"correct":[0]}]}'} />
        {err && <p className="form-error">{err}</p>}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-green" disabled={!text.trim()} onClick={run}>{kind === "lesson" ? "Import lesson" : kind === "schedule" ? "Import days" : "Import questions"}</button>
        </div>
      </div>
    </div>
  )
}
