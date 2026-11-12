"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { BlockView, LearnerState, Answers, Responses, Uploads } from "@/components/CourseBlocks"
import ImportModal from "@/components/ImportModal"
import RichText from "@/components/RichText"
import { PublishPill } from "@/components/StatusPill"
import { api, send } from "@/lib/client"
import { fmtSize, readPickedFile } from "@/lib/clientFiles"
import { htmlToText } from "@/lib/sanitize"
import { useRoles } from "@/lib/useRoles"
import { Block, Course, CoursePage, FILE_ACCEPT, MAX_FILE_BYTES, PASS_PERCENT, PROGRAMS, Question, uid } from "@/lib/types"
import { youtubeEmbedUrl } from "@/lib/video"

type Person = { id: string; name: string; role: string }

const KINDS: { type: Block["type"]; label: string; hint: string }[] = [
  { type: "text", label: "Text", hint: "Write like a document" },
  { type: "image", label: "Image", hint: "Picture or screenshot" },
  { type: "video", label: "Video", hint: "YouTube link" },
  { type: "quiz", label: "Quiz", hint: "Questions with answers" },
  { type: "file", label: "Document", hint: "PDF, slides, worksheet" },
  { type: "upload", label: "Upload request", hint: "Learner uploads a file" },
  { type: "response", label: "Written answer", hint: "Learner types a response" },
]
const kindOf = (t: Block["type"]) => KINDS.find((k) => k.type === t)!

const newQuestion = (): Question => ({ id: uid(), question: "", options: ["", ""], correct: [0], multi: false })

function newBlock(type: Block["type"]): Block {
  const id = uid()
  switch (type) {
    case "text": return { id, type, html: "" }
    case "image": return { id, type, src: "", alt: "", caption: "" }
    case "video": return { id, type, url: "" }
    case "file": return { id, type, name: "", mime: "", size: 0, data: "" }
    case "upload": return { id, type, prompt: "" }
    case "response": return { id, type, prompt: "" }
    default: return { id, type: "quiz", title: "", questions: [newQuestion()] }
  }
}

async function imageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That isn't an image file.")
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / bmp.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL("image/webp", 0.85)
  if (url.length > 2_500_000) throw new Error("That image is still too large after shrinking. Try a smaller one.")
  return url
}

function move<T>(arr: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return
  const [x] = arr.splice(from, 1)
  arr.splice(to, 0, x)
}

const blockSummary = (b: Block) =>
  b.type === "text" ? htmlToText(b.html).slice(0, 80) : b.type === "quiz" ? `${b.questions.length} question${b.questions.length === 1 ? "" : "s"}` : ""

export default function CourseBuilder() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [sel, setSel] = useState(0)
  const [selBlock, setSelBlock] = useState<string | null>(null)
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [importKind, setImportKind] = useState<null | { kind: "lesson" } | { kind: "quiz"; blockId: string } | { kind: "text"; blockId: string }>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const drag = useRef<{ kind: "block" | "page"; from: number } | null>(null)
  const saveRef = useRef<() => void>(() => {})

  useEffect(() => {
    api<Course>(`/api/courses/${id}`).then(setCourse).catch((e) => setError(e.message))
    api<Person[]>("/api/people").then(setPeople).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current() } }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])

  function edit(fn: (c: Course) => void) {
    setCourse((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next })
    setDirty(true)
  }

  async function save(next?: Course): Promise<boolean> {
    const target = next ?? course
    if (!target) return false
    setStatus("Saving...")
    setError("")
    try {
      const saved = await api<Course>(`/api/courses/${id}`, send("PUT", target))
      setCourse(saved)
      setSel((s) => Math.min(s, saved.pages.length - 1))
      setDirty(false)
      setStatus(`Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`)
      return true
    } catch (e) { setError((e as Error).message); setStatus(""); return false }
  }
  saveRef.current = () => { void save() }

  const [pvState, setPvState] = useState<{ answers: Answers; responses: Responses; uploads: Uploads }>({ answers: {}, responses: {}, uploads: {} })
  const [showKey, setShowKey] = useState(true)
  const pv: LearnerState = useMemo(() => ({
    ...pvState,
    setAnswers: (answers) => setPvState((s) => ({ ...s, answers })),
    setResponses: (responses) => setPvState((s) => ({ ...s, responses })),
    setUploads: (uploads) => setPvState((s) => ({ ...s, uploads })),
    showAnswers: showKey,
  }), [pvState, showKey])

  if (error && !course) return <main className="dash-main"><p className="form-error">{error}</p><Link href="/dashboard/instructor-courses" className="btn-back">← Back</Link></main>
  if (!course) return <main className="dash-main"><p className="muted">Loading...</p></main>

  const page = course.pages[Math.min(sel, course.pages.length - 1)]
  const pi = course.pages.indexOf(page)

  const patchBlock = (bi: number, patch: Partial<Block>) => edit((c) => { Object.assign(c.pages[pi].blocks[bi], patch) })
  const addBlock = (at: number, type: Block["type"]) => {
    const b = newBlock(type)
    edit((c) => { c.pages[pi].blocks.splice(at, 0, b) })
    setSelBlock(b.id)
    setInsertAt(null)
  }
  const moveBlock = (from: number, to: number) => edit((c) => move(c.pages[pi].blocks, from, to))
  const dupBlock = (bi: number) => {
    const copy = { ...structuredClone(page.blocks[bi]), id: uid() } as Block
    edit((c) => { c.pages[pi].blocks.splice(bi + 1, 0, copy) })
    setSelBlock(copy.id)
  }
  const removeBlock = (bi: number) => { edit((c) => { c.pages[pi].blocks.splice(bi, 1) }); setSelBlock(null) }
  const addPage = () => { edit((c) => { c.pages.push({ id: uid(), title: `Page ${c.pages.length + 1}`, blocks: [] }) }); setSel(course.pages.length); setSelBlock(null) }
  const dupPage = () => {
    const copy: CoursePage = { ...structuredClone(page), id: uid(), title: `${page.title || "Page"} (copy)`, blocks: structuredClone(page.blocks).map((b) => ({ ...b, id: uid() }) as Block) }
    edit((c) => { c.pages.splice(pi + 1, 0, copy) }); setSel(pi + 1)
  }
  const removePage = () => {
    if (course.pages.length === 1) return
    if (!confirm("Delete this page and everything on it?")) return
    edit((c) => { c.pages.splice(pi, 1) }); setSel(Math.max(0, pi - 1)); setSelBlock(null)
  }

  async function setPublished(published: boolean) { if (course) await save({ ...course, published }) }
  async function openAsLearner() { if (await save()) router.push(`/dashboard/courses/${id}`) }
  function goBack(e: React.MouseEvent) { if (dirty && !confirm("You have unsaved changes. Leave without saving?")) e.preventDefault() }

  function applyLesson(l: { title: string; description: string; pages: CoursePage[] }) {
    edit((c) => {
      c.pages.splice(pi + 1, 0, ...l.pages)
      if (c.title === "Untitled course" && l.title) c.title = l.title
      if (!c.description && l.description) c.description = l.description
    })
    setSel(pi + 1); setSelBlock(null); setImportKind(null)
  }
  function applyText(blockId: string, html: string) {
    edit((c) => { for (const p of c.pages) for (const b of p.blocks) if (b.id === blockId && b.type === "text") b.html = b.html + html })
    setImportKind(null)
  }

  const minOn = course.minMinutes !== null
  const minChoices = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120]
  if (course.minMinutes && !minChoices.includes(course.minMinutes)) minChoices.push(course.minMinutes)
  minChoices.sort((a, b) => a - b)

  return (
    <>
      <div className="bld-bar">
        <Link href="/dashboard/instructor-courses" className="btn-back" onClick={goBack}>← Back to courses</Link>
        <input className="input title-input" aria-label="Course title" value={course.title} onChange={(e) => edit((c) => { c.title = e.target.value })} />
        <PublishPill published={course.published} />
        <span className="saved" aria-live="polite">{dirty ? "Unsaved changes" : status}</span>
        <div className="seg" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === "edit"} className={mode === "edit" ? "on" : ""} onClick={() => setMode("edit")}> Edit</button>
          <button role="tab" aria-selected={mode === "preview"} className={mode === "preview" ? "on" : ""} onClick={() => { setMode("preview"); setSelBlock(null) }}> Preview</button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => save()} title="Ctrl+S">💾 Save</button>
        {course.published
          ? <button className="btn btn-outline btn-sm" onClick={() => setPublished(false)}>Unpublish</button>
          : <button className="btn btn-green btn-sm" onClick={() => setPublished(true)}>Publish course</button>}
      </div>

      <main className="dash-main wide">
        {error && <p className="form-error">{error}</p>}

        <div className="bld">
          {/* ---------- Left: pages ---------- */}
          <aside className="panel outline" aria-label="Pages">
            <h3>Pages</h3>
            {course.pages.map((p, i) => (
              <div
                key={p.id}
                className={`${over === `p:${i}` ? "drag-over" : ""}`}
                draggable={armed === `p:${p.id}`}
                onDragStart={() => { drag.current = { kind: "page", from: i } }}
                onDragEnd={() => { setArmed(null); setOver(null); drag.current = null }}
                onDragOver={(e) => { if (drag.current?.kind === "page") { e.preventDefault(); setOver(`p:${i}`) } }}
                onDrop={(e) => { e.preventDefault(); const d = drag.current; if (d?.kind === "page") { edit((c) => move(c.pages, d.from, i)); setSel(i) } setOver(null); setArmed(null) }}
              >
                <div className={`o-page${i === pi ? " active" : ""}`} role="button" tabIndex={0} onClick={() => { setSel(i); setSelBlock(null) }} onKeyDown={(e) => { if (e.key === "Enter") { setSel(i); setSelBlock(null) } }}>
                  <span className="grip" title="Drag to reorder" onMouseDown={() => setArmed(`p:${p.id}`)} onMouseUp={() => setArmed(null)}>⋮⋮</span>
                  <span className="n">{i + 1}</span>
                  <span className="t">{p.title || "Untitled page"}</span>
                  <span className="k">{p.blocks.length}</span>
                </div>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={addPage}>＋ Add page</button>
            <div className="btn-row">
              <button className="tool" title="Move page up" disabled={pi === 0} onClick={() => { edit((c) => move(c.pages, pi, pi - 1)); setSel(pi - 1) }}>↑</button>
              <button className="tool" title="Move page down" disabled={pi === course.pages.length - 1} onClick={() => { edit((c) => move(c.pages, pi, pi + 1)); setSel(pi + 1) }}>↓</button>
              <button className="tool" title="Duplicate page" onClick={dupPage}>⧉</button>
              <button className="tool danger" title="Delete page" disabled={course.pages.length === 1} onClick={removePage}></button>
            </div>
            <p className="hint">Drag ⋮⋮ to reorder pages.</p>
          </aside>

          {/* ---------- Middle: canvas or preview ---------- */}
          <section className="canvas">
            {mode === "edit" ? (
              <>
                <input className="page-title-input" aria-label="Page title" placeholder="Page title" value={page.title} onChange={(e) => edit((c) => { c.pages[pi].title = e.target.value })} />

                {page.blocks.length === 0 && (
                  <div className="panel card-pad" style={{ alignItems: "center", textAlign: "center", padding: "2rem" }}>
                    <strong>This page is empty</strong>
                    <span className="muted">Pick something to add. You can drag blocks around afterwards.</span>
                  </div>
                )}

                {page.blocks.map((b, bi) => (
                  <div key={b.id}>
                    <Inserter open={insertAt === bi} onToggle={() => setInsertAt(insertAt === bi ? null : bi)} onPick={(t) => addBlock(bi, t)} />
                    <div
                      className={`blk${selBlock === b.id ? " sel" : ""}${over === `b:${bi}` ? " drag-over" : ""}${armed === `b:${b.id}` && drag.current ? " dragging" : ""}`}
                      draggable={armed === `b:${b.id}`}
                      onClick={() => setSelBlock(b.id)}
                      onDragStart={() => { drag.current = { kind: "block", from: bi } }}
                      onDragEnd={() => { setArmed(null); setOver(null); drag.current = null }}
                      onDragOver={(e) => { if (drag.current?.kind === "block") { e.preventDefault(); setOver(`b:${bi}`) } }}
                      onDrop={(e) => { e.preventDefault(); const d = drag.current; if (d?.kind === "block") moveBlock(d.from, bi); setOver(null); setArmed(null) }}
                    >
                      <span className="grip" title="Drag to reorder" onMouseDown={() => setArmed(`b:${b.id}`)} onMouseUp={() => setArmed(null)}>⋮⋮</span>
                      <div className="blk-head">
                        <span className="blk-kind">{kindOf(b.type).label}{selBlock !== b.id && blockSummary(b) ? <span className="muted" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}> · {blockSummary(b)}</span> : null}</span>
                        <div className="blk-tools">
                          <button className="tool" title="Move up" disabled={bi === 0} onClick={(e) => { e.stopPropagation(); moveBlock(bi, bi - 1) }}>↑</button>
                          <button className="tool" title="Move down" disabled={bi === page.blocks.length - 1} onClick={(e) => { e.stopPropagation(); moveBlock(bi, bi + 1) }}>↓</button>
                          <button className="tool" title="Duplicate" onClick={(e) => { e.stopPropagation(); dupBlock(bi) }}>⧉</button>
                          <button className="tool danger" title="Remove" onClick={(e) => { e.stopPropagation(); removeBlock(bi) }}></button>
                        </div>
                      </div>
                      {selBlock === b.id ? (
                        <div className="blk-body">
                          <BlockEditor block={b} onChange={(p) => patchBlock(bi, p)} onImportText={() => setImportKind({ kind: "text", blockId: b.id })} onImportQuiz={() => setImportKind({ kind: "quiz", blockId: b.id })} />
                        </div>
                      ) : (
                        <div className="blk-view">
                          <BlockPreview block={b} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <Inserter open={insertAt === page.blocks.length} onToggle={() => setInsertAt(insertAt === page.blocks.length ? null : page.blocks.length)} onPick={(t) => addBlock(page.blocks.length, t)} />
                <div className="palette" aria-label="Add to this page">
                  <span className="palette-title">Add to this page</span>
                  {KINDS.map((k) => (
                    <button key={k.type} className="palette-btn" onClick={() => addBlock(page.blocks.length, k.type)}>
                      
                      <span>{k.label}<br /><span className="muted" style={{ fontWeight: 400, fontSize: ".72rem" }}>{k.hint}</span></span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="preview-banner">
                  <span> Preview: this is what learners see. Nothing here is saved.</span>
                  <div className="btn-row">
                    <label className="chk-row"><input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} /> Show answer key</label>
                    <button className="btn btn-outline btn-sm" onClick={openAsLearner}>Open full player</button>
                    <button className="btn btn-green btn-sm" onClick={() => setMode("edit")}>← Back to editing</button>
                  </div>
                </div>
                <div className="pv-steps">
                  {course.pages.map((p, i) => <button key={p.id} className={`pv-step${i === pi ? " on" : ""}`} onClick={() => setSel(i)}>{i + 1}. {p.title || "Untitled"}</button>)}
                </div>
                <div className="panel page-card">
                  {page.title && <h2 className="page-h">{page.title}</h2>}
                  {page.blocks.length === 0 && <p className="muted">This page is empty.</p>}
                  {page.blocks.map((b) => <BlockView key={b.id} block={b} st={pv} />)}
                </div>
                <div className="player-nav">
                  <button className="btn btn-outline" disabled={pi === 0} onClick={() => setSel(pi - 1)}>← Previous</button>
                  <button className="btn btn-outline" disabled={pi === course.pages.length - 1} onClick={() => setSel(pi + 1)}>Next →</button>
                </div>
              </>
            )}
          </section>

          {/* ---------- Right: settings ---------- */}
          <aside className="panel settings" aria-label="Course settings">
            <div className="side-sec">
              <h3>Status</h3>
              <div className="status-opts">
                <button className={`status-opt draft${!course.published ? " on" : ""}`} onClick={() => setPublished(false)}><strong> Draft</strong><span>Only admins see it</span></button>
                <button className={`status-opt live${course.published ? " on" : ""}`} onClick={() => setPublished(true)}><strong> Published</strong><span>Assigned people can take it</span></button>
              </div>
            </div>

            <div className="side-sec">
              <h3>Details</h3>
              <div className="field"><label htmlFor="prog">Program</label>
                <select id="prog" className="input" value={course.program} onChange={(e) => edit((c) => { c.program = e.target.value as Course["program"] })}>
                  <option value="">All programs</option>
                  {PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="ctype">Course type</label><input id="ctype" className="input" placeholder="Volunteer Basics" value={course.type} onChange={(e) => edit((c) => { c.type = e.target.value })} /></div>
              <div className="field"><label htmlFor="cdesc">Description</label><textarea id="cdesc" className="input" rows={3} value={course.description} onChange={(e) => edit((c) => { c.description = e.target.value })} /></div>
            </div>

            <div className="side-sec">
              <h3>Minimum time spent</h3>
              <div className="btn-row" style={{ flexWrap: "nowrap" }}>
                <select className="input" aria-label="Minimum time on or off" style={{ width: "6rem" }} value={minOn ? "on" : "off"} onChange={(e) => edit((c) => { c.minMinutes = e.target.value === "on" ? 10 : null })}>
                  <option value="off">Off</option>
                  <option value="on">On</option>
                </select>
                <select className="input" aria-label="Minutes" disabled={!minOn} value={course.minMinutes ?? 10} onChange={(e) => edit((c) => { c.minMinutes = Number(e.target.value) })}>
                  {minChoices.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
              <p className="hint">{minOn ? `Learners can't submit until they've spent ${course.minMinutes} minutes on the course.` : "Off: learners can submit as soon as they finish."} Quizzes need {PASS_PERCENT}% to pass.</p>
            </div>

            <AudiencePanel course={course} people={people} edit={edit} />

            <div className="side-sec">
              <h3>Claude</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setImportKind({ kind: "lesson" })}>✨ Import lesson from Claude</button>
              <p className="hint">Adds the imported pages after the current page.</p>
            </div>
          </aside>
        </div>
      </main>

      {importKind?.kind === "lesson" && <ImportModal kind="lesson" onClose={() => setImportKind(null)} onLesson={applyLesson} />}
      {importKind?.kind === "text" && <ImportModal kind="lesson" onClose={() => setImportKind(null)} onLesson={applyLesson} onText={(html) => applyText(importKind.blockId, html)} />}
      {importKind?.kind === "quiz" && (
        <ImportModal kind="quiz" onClose={() => setImportKind(null)} onQuestions={(qs) => {
          const blockId = importKind.blockId
          edit((c) => { for (const p of c.pages) for (const b of p.blocks) if (b.id === blockId && b.type === "quiz") b.questions = [...b.questions.filter((x) => x.question.trim()), ...qs] })
          setImportKind(null)
        }} />
      )}
    </>
  )
}

/* ---------- pieces ---------- */

function Inserter({ open, onToggle, onPick }: { open: boolean; onToggle: () => void; onPick: (t: Block["type"]) => void }) {
  return (
    <>
      <div className={`inserter${open ? " open" : ""}`}>
        <button className="ins-btn" onClick={onToggle} aria-label="Insert a block here" title="Insert a block here">{open ? "×" : "+"}</button>
      </div>
      {open && (
        <div className="palette" style={{ marginBottom: ".4rem" }}>
          <span className="palette-title">Insert here</span>
          {KINDS.map((k) => <button key={k.type} className="palette-btn" onClick={() => onPick(k.type)}><span>{k.label}</span></button>)}
        </div>
      )}
    </>
  )
}

const noop = () => {}
const previewState: LearnerState = { answers: {}, setAnswers: noop, responses: {}, setResponses: noop, uploads: {}, setUploads: noop, showAnswers: true }

function BlockPreview({ block }: { block: Block }) {
  const empty =
    (block.type === "text" && !htmlToText(block.html)) || (block.type === "image" && !block.src) || (block.type === "video" && !youtubeEmbedUrl(block.url)) ||
    (block.type === "file" && !block.data) || (block.type === "quiz" && block.questions.length === 0)
  if (empty) return <p className="blk-empty">Empty. Click to edit.</p>
  return <BlockView block={block} st={previewState} />
}

function AudiencePanel({ course, people, edit }: { course: Course; people: Person[]; edit: (fn: (c: Course) => void) => void }) {
  const [query, setQuery] = useState("")
  const chosen = course.assignedTo.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[]
  const matches = people.filter((p) => !course.assignedTo.includes(p.id) && (!query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()))).slice(0, 40)
  const targeted = course.roles.length > 0 || course.assignedTo.length > 0
  const { assignable } = useRoles()
  return (
    <div className="side-sec">
      <h3>Who takes this course</h3>
      <p className="hint">{targeted ? "Required for the roles and people below. Nobody else sees it." : "Not assigned: everyone can see it as optional. Pick roles or people to make it required."}</p>
      {assignable.map((r) => (
        <label key={r} className="chk-row">
          <input type="checkbox" checked={course.roles.includes(r)} onChange={(e) => edit((c) => { c.roles = e.target.checked ? [...c.roles, r] : c.roles.filter((x) => x !== r) })} />
          Everyone with role: {r}
        </label>
      ))}
      <div className="field" style={{ marginTop: ".4rem" }}>
        <label htmlFor="who">Assign to individual people</label>
        <input id="who" className="input" placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {chosen.length > 0 && (
        <div className="chips">
          {chosen.map((p) => <span key={p.id} className="chip blue">{p.name}<button aria-label={`Remove ${p.name}`} onClick={() => edit((c) => { c.assignedTo = c.assignedTo.filter((x) => x !== p.id) })}>✕</button></span>)}
        </div>
      )}
      <div className="pick-list" role="list">
        {matches.length === 0 && <div className="pick muted" style={{ cursor: "default" }}>{people.length === 0 ? "No instructor accounts yet." : "No more matches."}</div>}
        {matches.map((p) => (
          <button key={p.id} className="pick" onClick={() => edit((c) => { c.assignedTo = [...c.assignedTo, p.id] })}>
            <span>{p.name} <span className="muted">· {p.role}</span></span><span className="chip">＋ Assign</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BlockEditor({ block, onChange, onImportText, onImportQuiz }: { block: Block; onChange: (p: Partial<Block>) => void; onImportText: () => void; onImportQuiz: () => void }) {
  const [err, setErr] = useState("")

  if (block.type === "text") return <RichText value={block.html} onChange={(html) => onChange({ html })} onImport={onImportText} placeholder="Type here, like in a document…" />

  if (block.type === "image") {
    const pickImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]; e.target.value = ""
      if (!f) return
      setErr("")
      try { onChange({ src: await imageToDataUrl(f) }) } catch (x) { setErr((x as Error).message) }
    }
    return (
      <>
        <div className="btn-row">
          <input type="file" accept="image/*" onChange={pickImg} aria-label="Choose an image" />
          <span className="muted" style={{ fontSize: ".85rem" }}>or</span>
          <input className="input" style={{ flex: 1, minWidth: "14rem" }} placeholder="Paste an https:// image link" value={block.src.startsWith("data:") ? "" : block.src} onChange={(e) => onChange({ src: e.target.value })} />
        </div>
        {err && <p className="form-error">{err}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {block.src && <img className="preview-img" src={block.src} alt={block.alt} />}
        <input className="input" placeholder="Describe the image (for screen readers)" value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} />
        <input className="input" placeholder="Caption (optional)" value={block.caption} onChange={(e) => onChange({ caption: e.target.value })} />
      </>
    )
  }

  if (block.type === "video") {
    return (
      <>
        <input className="input" placeholder="Paste a YouTube link" value={block.url} onChange={(e) => onChange({ url: e.target.value })} />
        {block.url && (youtubeEmbedUrl(block.url)
          ? <div className="video-frame"><iframe src={youtubeEmbedUrl(block.url)!} title="Video preview" allowFullScreen /></div>
          : <p className="form-error">That doesn&apos;t look like a YouTube link. Only YouTube videos are supported.</p>)}
      </>
    )
  }

  if (block.type === "file") {
    const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]; e.target.value = ""
      if (!f) return
      setErr("")
      try { const p = await readPickedFile(f); onChange({ name: p.name, mime: p.mime, size: p.size, data: p.data }) } catch (x) { setErr((x as Error).message) }
    }
    return (
      <>
        {block.data ? (
          <div className="file-card">
            <span style={{ fontSize: "1.5rem" }}></span>
            <input className="input" style={{ flex: 1, minWidth: "10rem" }} aria-label="File name" value={block.name} onChange={(e) => onChange({ name: e.target.value })} />
            <span className="sz">{fmtSize(block.size)}</span>
            <button className="btn btn-outline btn-sm" onClick={() => onChange({ name: "", mime: "", size: 0, data: "" })}>Replace</button>
          </div>
        ) : (
          <div className="dropzone">
            <strong> Upload a document for learners to download</strong>
            <input type="file" accept={FILE_ACCEPT} onChange={pickFile} aria-label="Choose a document" />
            <span className="hint">PDF, Word, PowerPoint, Excel, image, text, CSV or ZIP. Up to {fmtSize(MAX_FILE_BYTES)}.</span>
          </div>
        )}
        {err && <p className="form-error">{err}</p>}
      </>
    )
  }

  if (block.type === "upload" || block.type === "response") {
    return (
      <>
        <input className="input" placeholder={block.type === "upload" ? "What should they upload? (e.g. Your lesson plan as a PDF)" : "What should they write? (e.g. Describe how you'd help a stuck student)"} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
        <p className="hint">{block.type === "upload" ? "Learners must attach a file before they can submit. Admins can open it from Submissions." : "Learners must write an answer before they can submit. Admins can read it from Submissions."}</p>
      </>
    )
  }

  return <QuizEditor block={block} onChange={onChange} onImport={onImportQuiz} />
}

function QuizEditor({ block, onChange, onImport }: { block: Extract<Block, { type: "quiz" }>; onChange: (p: Partial<Block>) => void; onImport: () => void }) {
  const setQ = (qi: number, fn: (q: Question) => void) => {
    const questions = structuredClone(block.questions)
    fn(questions[qi])
    onChange({ questions })
  }
  return (
    <>
      <input className="input" placeholder="Quiz title (optional)" value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
      {block.questions.map((q, qi) => (
        <div key={q.id} className="q-card">
          <div className="blk-head" style={{ marginBottom: 0 }}>
            <span className="blk-kind">Question {qi + 1}</span>
            <div className="qtype">
              <div className="seg" role="group" aria-label="Answer type">
                <button className={!q.multi ? "on" : ""} onClick={() => setQ(qi, (x) => { x.multi = false; x.correct = x.correct.slice(0, 1) })}>One answer</button>
                <button className={q.multi ? "on" : ""} onClick={() => setQ(qi, (x) => { x.multi = true })}>Select all that apply</button>
              </div>
              <button className="tool danger" title="Remove question" onClick={() => onChange({ questions: block.questions.filter((_, i) => i !== qi) })}></button>
            </div>
          </div>
          <textarea className="input" rows={2} placeholder="Question" value={q.question} onChange={(e) => setQ(qi, (x) => { x.question = e.target.value })} />
          {q.options.map((o, oi) => (
            <div key={oi} className="opt-row">
              {q.multi
                ? <input type="checkbox" checked={q.correct.includes(oi)} onChange={() => setQ(qi, (x) => { x.correct = x.correct.includes(oi) ? x.correct.filter((n) => n !== oi) : [...x.correct, oi].sort((a, b) => a - b) })} aria-label="Correct answer" />
                : <input type="radio" name={`c-${q.id}`} checked={q.correct[0] === oi} onChange={() => setQ(qi, (x) => { x.correct = [oi] })} aria-label="Correct answer" />}
              <input className="input" placeholder={`Option ${oi + 1}`} value={o} onChange={(e) => setQ(qi, (x) => { x.options[oi] = e.target.value })} />
              {q.options.length > 2 && (
                <button className="tool danger" title="Remove option" onClick={() => setQ(qi, (x) => {
                  x.options.splice(oi, 1)
                  x.correct = x.correct.filter((n) => n !== oi).map((n) => (n > oi ? n - 1 : n))
                  if (!x.multi && x.correct.length === 0) x.correct = [0]
                })}>✕</button>
              )}
            </div>
          ))}
          <div className="btn-row">
            {q.options.length < 6 && <button className="tool" onClick={() => setQ(qi, (x) => { x.options.push("") })}>＋ Add option</button>}
            <span className="hint">{q.multi ? "Tick every correct answer." : "Select the circle next to the correct answer."}</span>
          </div>
        </div>
      ))}
      <div className="btn-row">
        <button className="btn btn-outline btn-sm" onClick={() => onChange({ questions: [...block.questions, newQuestion()] })}>＋ Add question</button>
        <button className="btn btn-outline btn-sm" onClick={onImport}>✨ Import from Claude</button>
      </div>
      <span className="hint">Incomplete questions (no text, fewer than 2 options, or no correct answer ticked) are removed when you save.</span>
    </>
  )
}
