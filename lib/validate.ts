import { markdownToHtml, plainToHtml, sanitizeHtml } from "./sanitize"
import { ALLOWED_MIMES, Block, Course, CoursePage, Guide, GuideFile, MAX_FILE_BYTES, Question, ScheduleDay, SubmittedFile, isProgramId, uid } from "./types"
import { youtubeEmbedUrl } from "./video"

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

/** Checks a base64 data URL against the allowed file types and size. Returns null if it isn't acceptable. */
export function parseDataUrl(src: unknown): { mime: string; size: number } | null {
  if (typeof src !== "string" || !src.startsWith("data:")) return null
  const cut = src.indexOf(";base64,")
  if (cut < 0) return null
  const mime = src.slice(5, cut).toLowerCase()
  const b64 = src.slice(cut + 8)
  if (!ALLOWED_MIMES[mime] || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) return null
  const size = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0)
  if (size <= 0 || size > MAX_FILE_BYTES) return null
  return { mime, size }
}

export function cleanQuestion(q: any): Question | null {
  const question = str(q?.question, 500).trim()
  const raw: string[] = Array.isArray(q?.options) ? q.options.slice(0, 12).map((o: unknown) => str(o, 300).trim()) : []
  const rawCorrect: number[] = (Array.isArray(q?.correct) ? q.correct : [q?.correct]).map(Number).filter((n: number) => Number.isInteger(n))
  // Drop blank options but keep "correct" pointing at the same answers.
  const keep = raw.map((o, i) => (o ? i : -1)).filter((i) => i >= 0)
  const options = keep.map((i) => raw[i])
  let correct = [...new Set(rawCorrect.map((c) => keep.indexOf(c)).filter((i) => i >= 0))].sort((a, b) => a - b)
  const multi = q?.multi === true || correct.length > 1
  if (!multi) correct = correct.slice(0, 1)
  if (!question || options.length < 2 || options.length > 6 || correct.length === 0) return null
  return { id: str(q?.id, 20) || uid(), question, options, correct, multi }
}

/** Validates quiz data coming from the "Import from Claude" box. */
export function parseQuizImport(raw: unknown): { questions: Question[] } | { error: string } {
  const list = Array.isArray(raw) ? raw : (raw as any)?.questions
  if (!Array.isArray(list) || list.length === 0) return { error: 'Expected {"questions":[...]} with at least one question.' }
  if (list.length > 50) return { error: "A quiz can have at most 50 questions." }
  const questions: Question[] = []
  for (let i = 0; i < list.length; i++) {
    const q = cleanQuestion({ ...list[i], id: undefined })
    if (!q) return { error: `Question ${i + 1} is invalid. It needs text, 2 to 6 options, and a "correct" number (or list of numbers) that points at the right option(s). 0 is the first option.` }
    questions.push(q)
  }
  return { questions }
}

export function cleanBlock(b: any): Block | null {
  const id = str(b?.id, 20) || uid()
  switch (b?.type) {
    case "text": {
      const html = typeof b.html === "string" ? b.html : plainToHtml(str(b.text, 20000))
      return { id, type: "text", html: sanitizeHtml(html) }
    }
    case "image": {
      const src = str(b.src, 2_800_000)
      const ok = /^data:image\/(png|jpeg|webp|gif);base64,/.test(src) || /^https:\/\//.test(src)
      return { id, type: "image", src: ok ? src : "", alt: str(b.alt, 300), caption: str(b.caption, 500) }
    }
    case "video": {
      const url = str(b.url, 500)
      return { id, type: "video", url: youtubeEmbedUrl(url) ? url : "" }
    }
    case "file": {
      const data = typeof b.data === "string" ? b.data : ""
      const info = parseDataUrl(data)
      if (!info) return null
      return { id, type: "file", name: str(b.name, 200).trim() || "document", mime: info.mime, size: info.size, data }
    }
    case "quiz": {
      const questions = (Array.isArray(b.questions) ? b.questions : []).slice(0, 50).map(cleanQuestion).filter(Boolean) as Question[]
      return { id, type: "quiz", title: str(b.title, 200), questions }
    }
    case "upload":
      return { id, type: "upload", prompt: str(b.prompt, 500) }
    case "response":
      return { id, type: "response", prompt: str(b.prompt, 500) }
    default:
      return null
  }
}

/** Rebuilds a course from untrusted input, keeping only known fields and sane sizes. */
export function sanitizeCourse(input: any, existing: Course, validRoles: string[]): Course {
  const pages: CoursePage[] = (Array.isArray(input?.pages) ? input.pages : []).slice(0, 50).map((p: any) => ({
    id: str(p?.id, 20) || uid(),
    title: str(p?.title, 200),
    blocks: (Array.isArray(p?.blocks) ? p.blocks : []).slice(0, 100).map(cleanBlock).filter(Boolean) as Block[],
  }))
  const t = Number(input?.minMinutes)
  const roles = (Array.isArray(input?.roles) ? input.roles : []).filter((r: unknown) => validRoles.includes(r as string))
  const assigned = (Array.isArray(input?.assignedTo) ? input.assignedTo : []).filter((x: unknown) => typeof x === "string").slice(0, 500)
  return {
    ...existing,
    title: str(input?.title, 200).trim() || "Untitled course",
    type: str(input?.type, 100).trim(),
    program: isProgramId(input?.program) ? input.program : "",
    description: str(input?.description, 2000),
    minMinutes: Number.isFinite(t) && t > 0 ? Math.min(Math.round(t), 600) : null,
    published: input?.published === true,
    roles: [...new Set<string>(roles)] as Course["roles"],
    assignedTo: [...new Set<string>(assigned)],
    pages: pages.length ? pages : [{ id: uid(), title: "Page 1", blocks: [] }],
    updatedAt: new Date().toISOString(),
  }
}

/** Validates a whole lesson pasted from Claude (see skills/ngc-lesson-builder). */
export function parseLessonImport(raw: unknown): { title: string; description: string; pages: CoursePage[] } | { error: string } {
  const lesson: any = (raw as any)?.lesson ?? raw
  const list = Array.isArray(lesson?.pages) ? lesson.pages : null
  if (!list || list.length === 0) return { error: 'Expected {"lesson":{"title":"...","pages":[...]}} with at least one page.' }
  if (list.length > 30) return { error: "A lesson can have at most 30 pages." }
  const pages: CoursePage[] = list.map((p: any, i: number) => ({
    id: uid(),
    title: str(p?.title, 200) || `Page ${i + 1}`,
    blocks: (Array.isArray(p?.blocks) ? p.blocks : [])
      .slice(0, 60)
      .filter((b: any) => ["text", "quiz", "video", "response"].includes(b?.type))
      .map((b: any) => cleanBlock({ ...b, id: undefined, html: b?.type === "text" && typeof b.html !== "string" && typeof b.markdown === "string" ? markdownToHtml(b.markdown) : b?.html }))
      .filter(Boolean) as Block[],
  }))
  if (pages.every((p) => p.blocks.length === 0)) return { error: "None of the pages had usable content." }
  return { title: str(lesson?.title, 200).trim(), description: str(lesson?.description, 2000).trim(), pages }
}

/** A learner's uploaded file: same rules as documents. */
export function cleanSubmittedFile(f: any, blockId: string): SubmittedFile | null {
  const data = typeof f?.data === "string" ? f.data : ""
  const info = parseDataUrl(data)
  if (!info) return null
  return { blockId, name: str(f?.name, 200).trim() || "upload", mime: info.mime, size: info.size, data }
}

export function cleanGuideFile(f: any, existing?: GuideFile[]): GuideFile | null {
  const kept = existing?.find((e) => e.id === f?.id)
  if (kept && !f?.data) return { ...kept, name: str(f?.name, 200).trim() || kept.name }
  const data = typeof f?.data === "string" ? f.data : ""
  const info = parseDataUrl(data)
  if (!info) return null
  return { id: str(f?.id, 20) || uid(), name: str(f?.name, 200).trim() || "document", mime: info.mime, size: info.size, data }
}

export function sanitizeGuide(input: any, existing: Guide, validRoles: string[]): Guide {
  const files = (Array.isArray(input?.files) ? input.files : []).slice(0, 20).map((f: any) => cleanGuideFile(f, existing.files)).filter(Boolean) as GuideFile[]
  return {
    ...existing,
    title: str(input?.title, 200).trim() || "Untitled guide",
    program: isProgramId(input?.program) ? input.program : "",
    summary: str(input?.summary, 400),
    html: sanitizeHtml(str(input?.html, 120000), 120000),
    files,
    roles: (Array.isArray(input?.roles) ? input.roles : []).filter((r: unknown, i: number, a: unknown[]) => validRoles.includes(r as string) && a.indexOf(r) === i),
    assignedTo: (Array.isArray(input?.assignedTo) ? input.assignedTo : []).filter((x: unknown, i: number, a: unknown[]) => typeof x === "string" && a.indexOf(x) === i).slice(0, 500).map((x: string) => x.slice(0, 40)),
    updatedAt: new Date().toISOString(),
  }
}

/** Learners must never receive the answer key. */
export function stripAnswers(c: Course): Course {
  return {
    ...c,
    pages: c.pages.map((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.type === "quiz" ? { ...b, questions: b.questions.map((q) => ({ ...q, correct: [] })) } : b)),
    })),
  }
}

const isRealDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d
const cleanTime = (t: unknown) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str(t, 8).trim())
  return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, "0")}:${m[2]}` : ""
}

export function cleanScheduleDay(d: any): ScheduleDay | null {
  const date = str(d?.date, 10).trim()
  if (!isRealDate(date)) return null
  return {
    id: str(d?.id, 20) || uid(), date, title: str(d?.title, 200).trim(), startTime: cleanTime(d?.startTime),
    endTime: cleanTime(d?.endTime), location: str(d?.location, 200).trim(), notes: str(d?.notes, 500).trim(),
  }
}

/** Rebuilds the whole schedule from untrusted input, sorted by date. */
export function sanitizeSchedule(input: unknown): ScheduleDay[] {
  const list = Array.isArray(input) ? input : []
  return (list.slice(0, 500).map(cleanScheduleDay).filter(Boolean) as ScheduleDay[]).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

/** Validates a schedule pasted from Claude (see skills/ngc-schedule-builder). */
export function parseScheduleImport(raw: unknown): { days: ScheduleDay[] } | { error: string } {
  const list = Array.isArray(raw) ? raw : (raw as any)?.schedule?.days ?? (raw as any)?.days
  if (!Array.isArray(list) || list.length === 0) return { error: 'Expected {"schedule":{"days":[...]}} with at least one day.' }
  if (list.length > 500) return { error: "A schedule can have at most 500 days." }
  const days: ScheduleDay[] = []
  for (let i = 0; i < list.length; i++) {
    const d = cleanScheduleDay({ ...list[i], id: undefined })
    if (!d) return { error: `Day ${i + 1} has no valid date. Dates must look like 2026-11-14 (year-month-day).` }
    days.push(d)
  }
  return { days }
}
