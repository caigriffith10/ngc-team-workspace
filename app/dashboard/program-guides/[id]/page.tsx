"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import RichText from "@/components/RichText"
import { api, send } from "@/lib/client"
import { fmtSize, readPickedFile } from "@/lib/clientFiles"
import { sanitizeHtml } from "@/lib/sanitize"
import { useRoles } from "@/lib/useRoles"
import { FILE_ACCEPT, GuideFile, MAX_FILE_BYTES, Me, PROGRAMS, programName, uid } from "@/lib/types"

type G = { id: string; title: string; program: string; summary: string; html: string; files: (Omit<GuideFile, "data"> & { data?: string })[]; roles: string[]; assignedTo: string[]; authorId: string; authorName: string; updatedAt: string }

type Person = { id: string; name: string; role: string }

function AudiencePicker({ draft, setDraft, people }: { draft: G; setDraft: (g: G) => void; people: Person[] }) {
  const { assignable } = useRoles()
  const [specific, setSpecific] = useState(draft.roles.length + draft.assignedTo.length > 0)
  const [query, setQuery] = useState("")
  const chosen = draft.assignedTo.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[]
  const q = query.trim().toLowerCase()
  const matches = people.filter((p) => !draft.assignedTo.includes(p.id) && (!q || p.name.toLowerCase().includes(q))).slice(0, 40)
  return (
    <div className="field">
      <label htmlFor="gw">Who can see this guide</label>
      <select id="gw" className="input" style={{ maxWidth: "24rem" }} value={specific ? "some" : "all"} onChange={(e) => {
        const some = e.target.value === "some"
        setSpecific(some)
        if (!some) setDraft({ ...draft, roles: [], assignedTo: [] })
      }}>
        <option value="all">Everyone</option>
        <option value="some">Only certain roles or people</option>
      </select>
      {specific && (
        <div className="panel card-pad" style={{ gap: ".5rem", padding: "1rem" }}>
          <p className="hint">Admins and Senior Leads always see every guide. {draft.roles.length + draft.assignedTo.length === 0 ? "Nothing picked yet, so right now only they can see it." : ""}</p>
          {assignable.map((r) => (
            <label key={r} className="chk-row">
              <input type="checkbox" checked={draft.roles.includes(r)} onChange={(e) => setDraft({ ...draft, roles: e.target.checked ? [...draft.roles, r] : draft.roles.filter((x) => x !== r) })} />
              Everyone with role: {r}
            </label>
          ))}
          <input className="input" placeholder="Search people by name…" aria-label="Search people" value={query} onChange={(e) => setQuery(e.target.value)} />
          {chosen.length > 0 && (
            <div className="chips">
              {chosen.map((p) => <span key={p.id} className="chip blue">{p.name}<button aria-label={`Remove ${p.name}`} onClick={() => setDraft({ ...draft, assignedTo: draft.assignedTo.filter((x) => x !== p.id) })}>✕</button></span>)}
            </div>
          )}
          <div className="pick-list" role="list">
            {matches.length === 0 && <div className="pick muted" style={{ cursor: "default" }}>{people.length === 0 ? "No accounts yet." : "No more matches."}</div>}
            {matches.map((p) => (
              <button key={p.id} className="pick" onClick={() => setDraft({ ...draft, assignedTo: [...draft.assignedTo, p.id] })}>
                <span>{p.name} <span className="muted">· {p.role}</span></span><span className="chip">＋ Add</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GuidePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [guide, setGuide] = useState<G | null>(null)
  const [draft, setDraft] = useState<G | null>(null)
  const [error, setError] = useState("")
  const [fileErr, setFileErr] = useState("")
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState("")
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => {})
    api<Person[]>("/api/people").then(setPeople).catch(() => {})
    api<G>(`/api/guides/${id}`).then((g) => {
      setGuide(g)
      if (new URLSearchParams(window.location.search).get("edit") === "1") setDraft(structuredClone(g))
    }).catch((e) => setError(e.message))
  }, [id])

  if (error && !guide) return <main className="dash-main"><p className="form-error">{error}</p><Link href="/dashboard/program-guides" className="btn-back">← Back to guides</Link></main>
  if (!guide || !me) return <main className="dash-main"><p className="muted">Loading...</p></main>

  const canEdit = me.permissions.includes("editGuides")
  const canDelete = me.role === "Admin" || guide.authorId === me.id

  async function save() {
    if (!draft) return
    setBusy(true); setError("")
    try {
      const saved = await api<G>(`/api/guides/${id}`, send("PUT", draft))
      setGuide(saved); setDraft(null)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm(`Delete "${guide!.title}"?`)) return
    try { await api(`/api/guides/${id}`, send("DELETE")); router.push("/dashboard/program-guides") } catch (e) { setError((e as Error).message) }
  }

  async function importDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""
    if (!f || !draft) return
    setImportErr(""); setImporting(true)
    try {
      const fd = new FormData(); fd.append("file", f)
      const res = await fetch("/api/guides/import", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Import failed.")
      setDraft((d) => (d ? { ...d, title: !d.title || d.title === "Untitled guide" ? data.title || d.title : d.title, html: d.html.replace(/<[^>]*>/g, "").trim() ? d.html + data.html : data.html } : d))
    } catch (x) { setImportErr((x as Error).message) } finally { setImporting(false) }
  }

  async function addFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""
    if (!f || !draft) return
    setFileErr("")
    try {
      const p = await readPickedFile(f)
      setDraft({ ...draft, files: [...draft.files, { id: uid(), name: p.name, mime: p.mime, size: p.size, data: p.data }] })
    } catch (x) { setFileErr((x as Error).message) }
  }

  // ---------- editing ----------
  if (draft) {
    return (
      <main className="dash-main">
        <div className="toolbar">
          <button className="btn-back" onClick={() => { if (confirm("Discard your changes?")) setDraft(null) }}>← Cancel</button>
          <div className="btn-row">
            <button className="btn btn-outline" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn btn-green" onClick={save} disabled={busy}>{busy ? "Saving..." : "💾 Save guide"}</button>
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="panel card-pad" style={{ gap: "1rem", padding: "1.5rem" }}>
          <div className="field"><label htmlFor="gt">Title</label><input id="gt" className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="btn-row" style={{ alignItems: "flex-start" }}>
            <div className="field" style={{ minWidth: "14rem" }}>
              <label htmlFor="gp">Program</label>
              <select id="gp" className="input" value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value })}>
                <option value="">General (all programs)</option>
                {PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: "16rem" }}><label htmlFor="gs">Short summary (shown on the card)</label><input id="gs" className="input" maxLength={400} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></div>
          </div>
          <AudiencePicker draft={draft} setDraft={setDraft} people={people} />
          <div className="field">
            <label>Guide</label>
            {me.role === "Admin" && (
              <div className="field" style={{ gap: ".25rem" }}>
                <input type="file" accept=".pdf,.docx" onChange={importDoc} disabled={importing} aria-label="Import a PDF or Word file" />
                <span className="hint">{importing ? "Importing..." : "Import a PDF or Word (.docx) file: its text is added to the guide below so you can edit it."}</span>
                {importErr && <p className="form-error">{importErr}</p>}
              </div>
            )}
            <RichText value={draft.html} onChange={(html) => setDraft((d) => (d ? { ...d, html } : d))} minHeight="18rem" placeholder="Write the guide here, like in a document…" />
          </div>
          <div className="field">
            <label>Documents (lesson plans, slides, worksheets)</label>
            {draft.files.map((f) => (
              <div key={f.id} className="file-card">
                <span style={{ fontSize: "1.3rem" }}></span>
                <input className="input" style={{ flex: 1, minWidth: "10rem" }} aria-label="File name" value={f.name} onChange={(e) => setDraft({ ...draft, files: draft.files.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)) })} />
                <span className="sz">{fmtSize(f.size)}</span>
                <button className="btn btn-danger btn-sm" onClick={() => setDraft({ ...draft, files: draft.files.filter((x) => x.id !== f.id) })}>Remove</button>
              </div>
            ))}
            <input type="file" accept={FILE_ACCEPT} onChange={addFile} aria-label="Add a document" />
            <span className="hint">PDF, Word, PowerPoint, Excel, image, text, CSV or ZIP. Up to {fmtSize(MAX_FILE_BYTES)} each.</span>
            {fileErr && <p className="form-error">{fileErr}</p>}
          </div>
        </div>
      </main>
    )
  }

  // ---------- reading ----------
  return (
    <main className="dash-main">
      <div className="toolbar">
        <Link href="/dashboard/program-guides" className="btn-back">← All guides</Link>
        {canEdit && (
          <div className="btn-row">
            <button className="btn btn-blue btn-sm" onClick={() => setDraft(structuredClone(guide))}>✏️ Edit guide</button>
            {canDelete && <button className="btn btn-danger btn-sm" onClick={remove}>🗑 Delete</button>}
          </div>
        )}
      </div>
      <article className="panel guide-body">
        <div className="chips" style={{ marginBottom: ".75rem" }}>
          <span className="chip purple">{guide.program ? programName(guide.program) : "General"}</span>
          {canEdit && guide.roles.length + guide.assignedTo.length > 0 && <span className="chip">Limited: {[...guide.roles, ...(guide.assignedTo.length ? [`${guide.assignedTo.length} ${guide.assignedTo.length === 1 ? "person" : "people"}`] : [])].join(", ")}</span>}
          <span className="muted" style={{ fontSize: ".82rem" }}>By {guide.authorName} · updated {new Date(guide.updatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        <h1 style={{ marginTop: 0 }}>{guide.title}</h1>
        {guide.summary && <p className="muted" style={{ fontSize: "1.05rem" }}>{guide.summary}</p>}
        {guide.html ? <div className="rich" dangerouslySetInnerHTML={{ __html: sanitizeHtml(guide.html, 120000) }} /> : <p className="muted">This guide is empty so far.</p>}
        {guide.files.length > 0 && (
          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
            <h3 style={{ margin: 0 }}>Documents</h3>
            {guide.files.map((f) => (
              <div key={f.id} className="file-card">
                <span style={{ fontSize: "1.3rem" }}></span><span className="nm">{f.name}</span><span className="sz">{fmtSize(f.size)}</span>
                <a className="btn btn-outline btn-sm" href={`/api/guides/${guide.id}/files/${f.id}`}>⬇ Download</a>
              </div>
            ))}
          </div>
        )}
      </article>
    </main>
  )
}
