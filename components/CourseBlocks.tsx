"use client"

import { useState } from "react"
import { fmtSize, PickedFile, readPickedFile } from "@/lib/clientFiles"
import { sanitizeHtml } from "@/lib/sanitize"
import { Block, FILE_ACCEPT, MAX_FILE_BYTES } from "@/lib/types"
import { youtubeEmbedUrl } from "@/lib/video"

export type Answers = Record<string, number[]>
export type Responses = Record<string, string>
export type Uploads = Record<string, PickedFile>

export type LearnerState = {
  answers: Answers
  setAnswers: (a: Answers) => void
  responses: Responses
  setResponses: (r: Responses) => void
  uploads: Uploads
  setUploads: (u: Uploads) => void
  /** Admin preview only: mark the right answers. */
  showAnswers?: boolean
}

/** Shows one block the way a learner sees it. Used by the course player and the builder's preview. */
export function BlockView({ block, st }: { block: Block; st: LearnerState }) {
  const [err, setErr] = useState("")

  if (block.type === "text") return <div className="rich" dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }} />

  if (block.type === "image") {
    return block.src ? (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.src} alt={block.alt} />
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    ) : null
  }

  if (block.type === "video") {
    const src = youtubeEmbedUrl(block.url)
    return src ? <div className="video-frame"><iframe src={src} title="Video" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : null
  }

  if (block.type === "file") {
    return (
      <div className="file-card">
        <span style={{ fontSize: "1.5rem" }} aria-hidden="true"></span>
        <span className="nm">{block.name}</span>
        <span className="sz">{fmtSize(block.size)}</span>
        <a className="btn btn-outline btn-sm" href={block.data} download={block.name}>Download</a>
      </div>
    )
  }

  if (block.type === "quiz") {
    return (
      <div className="quiz-box">
        {block.title && <h3>{block.title}</h3>}
        {block.questions.map((q, qi) => {
          const chosen = st.answers[q.id] ?? []
          const toggle = (oi: number) => {
            if (q.multi) st.setAnswers({ ...st.answers, [q.id]: chosen.includes(oi) ? chosen.filter((x) => x !== oi) : [...chosen, oi].sort((a, b) => a - b) })
            else st.setAnswers({ ...st.answers, [q.id]: [oi] })
          }
          return (
            <div key={q.id} className="quiz-q">
              <p>{qi + 1}. {q.question}</p>
              {q.multi && <p className="sub">Select all that apply.</p>}
              {q.options.map((o, oi) => {
                const isKey = !!st.showAnswers && q.correct.includes(oi)
                return (
                  <label key={oi} className={`choice${chosen.includes(oi) ? " picked" : ""}${isKey ? " key" : ""}`}>
                    <input type={q.multi ? "checkbox" : "radio"} name={q.id} checked={chosen.includes(oi)} onChange={() => toggle(oi)} />
                    {o}
                    {isKey && <span className="tag">✓ correct</span>}
                  </label>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  if (block.type === "upload") {
    const f = st.uploads[block.id]
    async function pick(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return
      setErr("")
      try { st.setUploads({ ...st.uploads, [block.id]: await readPickedFile(file) }) } catch (x) { setErr((x as Error).message) }
    }
    return (
      <div className={`dropzone${f ? " has" : ""}`}>
        <strong> {block.prompt || "Upload a file"}</strong>
        {f ? (
          <div className="file-card" style={{ background: "var(--surface)" }}>
            <span className="nm">{f.name}</span><span className="sz">{fmtSize(f.size)}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { const { [block.id]: _gone, ...rest } = st.uploads; st.setUploads(rest) }}>Remove</button>
          </div>
        ) : (
          <>
            <input type="file" accept={FILE_ACCEPT} onChange={pick} aria-label={block.prompt || "Upload a file"} />
            <span className="hint">PDF, image, Word, PowerPoint, Excel, text, CSV or ZIP. Up to {fmtSize(MAX_FILE_BYTES)}. Required.</span>
          </>
        )}
        {err && <p className="form-error">{err}</p>}
      </div>
    )
  }

  // response
  return (
    <div className="field">
      <label> {block.prompt || "Your answer"} <span className="muted" style={{ fontWeight: 400 }}>(required)</span></label>
      <textarea className="input" rows={5} value={st.responses[block.id] ?? ""} onChange={(e) => st.setResponses({ ...st.responses, [block.id]: e.target.value })} />
    </div>
  )
}

/** What the learner still has to do before they can submit (empty list = ready). */
export function missingItems(blocks: Block[], st: Pick<LearnerState, "answers" | "responses" | "uploads">): string[] {
  const out: string[] = []
  for (const b of blocks) {
    if (b.type === "quiz") {
      const n = b.questions.filter((q) => !(st.answers[q.id]?.length)).length
      if (n) out.push(`${n} quiz question${n === 1 ? "" : "s"} still unanswered`)
    } else if (b.type === "response" && !st.responses[b.id]?.trim()) out.push(`Write your answer: ${b.prompt || "written answer"}`)
    else if (b.type === "upload" && !st.uploads[b.id]) out.push(`Upload a file: ${b.prompt || "file upload"}`)
  }
  return out
}
