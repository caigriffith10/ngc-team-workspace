"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { api, send } from "@/lib/client"
import { Me, PROGRAMS, programName } from "@/lib/types"

type GuideLite = { id: string; title: string; program: string; summary: string; authorName: string; updatedAt: string; fileCount: number; restricted?: boolean }

export default function ProgramGuides() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [guides, setGuides] = useState<GuideLite[] | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => {})
    api<GuideLite[]>("/api/guides").then(setGuides).catch((e) => setError(e.message))
    const want = new URLSearchParams(window.location.search).get("program")
    if (want && (PROGRAMS.some((p) => p.id === want) || want === "general")) setFilter(want)
  }, [])

  async function create() {
    setCreating(true)
    try {
      const { id } = await api<{ id: string }>("/api/guides", send("POST"))
      router.push(`/dashboard/program-guides/${id}?edit=1`)
    } catch (e) { setError((e as Error).message); setCreating(false) }
  }

  const canEdit = !!me && me.permissions.includes("editGuides")
  const shown = (guides ?? []).filter((g) => filter === "all" || (filter === "general" ? g.program === "" : g.program === filter))

  return (
    <main className="dash-main wide">
      <div className="page-title">
        <div>
          <h1>Program Guides</h1>
          <p>{canEdit ? "Write and update the guides instructors use in class." : "Guides written by the senior leads for each program."}</p>
        </div>
        {canEdit && <button className="btn btn-green" onClick={create} disabled={creating}>{creating ? "Creating..." : "＋ New guide"}</button>}
      </div>

      <div className="prog-tabs" role="tablist" aria-label="Program">
        <button className={`prog-tab${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All</button>
        {PROGRAMS.map((p) => <button key={p.id} className={`prog-tab${filter === p.id ? " on" : ""}`} onClick={() => setFilter(p.id)}>{p.name}</button>)}
        <button className={`prog-tab${filter === "general" ? " on" : ""}`} onClick={() => setFilter("general")}> General</button>
      </div>

      <div className="chips" style={{ marginBottom: "1.25rem" }}>
        <span className="muted" style={{ fontSize: ".85rem" }}>Tools we teach with:</span>
        <a className="chip" href="https://code.org" target="_blank" rel="noopener noreferrer">JavaScript (code.org) ↗</a>
        <a className="chip" href="https://code.org" target="_blank" rel="noopener noreferrer">CSP (code.org) ↗</a>
        <a className="chip" href="https://scratch.mit.edu" target="_blank" rel="noopener noreferrer">Scratch (scratch.mit.edu) ↗</a>
        <a className="chip" href="https://cs50.dev" target="_blank" rel="noopener noreferrer">Python (cs50.dev) ↗</a>
      </div>

      {error && <p className="form-error">{error}</p>}
      {guides && shown.length === 0 && (
        <div className="panel card-pad" style={{ padding: "2rem", textAlign: "center", alignItems: "center" }}>
          <strong>No guides here yet</strong>
          <span className="muted">{canEdit ? "Click “New guide” to write the first one." : "A senior lead hasn't added one for this program yet."}</span>
        </div>
      )}
      <div className="guide-grid">
        {shown.map((g) => (
          <Link key={g.id} href={`/dashboard/program-guides/${g.id}`} className={`panel guide-card ${g.program}`}>
            <div className="chips">
              <span className="chip purple">{g.program ? programName(g.program) : "General"}</span>
              {canEdit && g.restricted && <span className="chip">Limited</span>}
              {g.fileCount > 0 && <span className="chip">{g.fileCount}</span>}
            </div>
            <h3>{g.title}</h3>
            {g.summary && <p>{g.summary}</p>}
            <p style={{ fontSize: ".78rem" }}>By {g.authorName} · updated {new Date(g.updatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
