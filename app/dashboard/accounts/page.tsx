"use client"

import { useEffect, useState } from "react"
import { api, send } from "@/lib/client"
import { useRoles } from "@/lib/useRoles"
import { PublicAccount } from "@/lib/types"

type Row = PublicAccount & { password: string }

function suggestPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => chars[b % chars.length]).join("")
}

const blank = { name: "", username: "", email: "", role: "Volunteer", password: "" }

export default function AccountsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [meId, setMeId] = useState("")
  const roles = useRoles()

  const load = () => api<Row[]>("/api/accounts").then(setRows).catch((e) => setError(e.message))
  useEffect(() => { load(); api<PublicAccount>("/api/me").then((m) => setMeId(m.id)).catch(() => {}) }, [])

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      if (editing) await api(`/api/accounts/${editing}`, send("PATCH", form))
      else await api("/api/accounts", send("POST", form))
      setForm(blank)
      setEditing(null)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(r: Row) {
    setEditing(r.id)
    setForm({ name: r.name, username: r.username, email: r.email, role: r.role, password: r.password })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function remove(r: Row) {
    if (!confirm(`Delete ${r.name} (${r.username})? Their course records are removed too.`)) return
    try { await api(`/api/accounts/${r.id}`, send("DELETE")); load() } catch (err) { setError((err as Error).message) }
  }

  const toggle = (id: string) => setShown((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <main className="dash-main wide">
      <div className="page-title">
        <div>
          <h1>Accounts</h1>
          <p>You choose each person&apos;s username and password, then give it to them.</p>
        </div>
      </div>

      <form className="panel form-row" onSubmit={submit}>
        <div className="field"><label htmlFor="n">Full name</label><input id="n" className="input" required value={form.name} onChange={set("name")} /></div>
        <div className="field"><label htmlFor="u">Username</label><input id="u" className="input" required value={form.username} onChange={set("username")} /></div>
        <div className="field"><label htmlFor="e">Email (optional)</label><input id="e" type="email" className="input" value={form.email} onChange={set("email")} /></div>
        <div className="field">
          <label htmlFor="r">Role</label>
          <select id="r" className="input" value={form.role} onChange={set("role")} disabled={editing === meId}>
            {roles.all.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="p">Password (min 6)</label>
          <input id="p" className="input mono" required minLength={6} value={form.password} onChange={set("password")} />
        </div>
        <button type="button" className="btn btn-outline btn-inline" onClick={() => setForm({ ...form, password: suggestPassword() })}>Suggest</button>
        <button type="submit" className="btn btn-green btn-inline" disabled={busy}>{editing ? "Save changes" : "Create login"}</button>
        {editing && <button type="button" className="btn btn-outline btn-inline" onClick={() => { setEditing(null); setForm(blank) }}>Cancel</button>}
        {error && <p className="form-error full">{error}</p>}
      </form>

      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Username</th><th>Password</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}{r.id === meId && <span className="muted"> (you)</span>}</td>
                <td className="mono">{r.username}</td>
                <td className="mono">
                  {shown.has(r.id) ? r.password : "••••••••"}
                  <button className="link-btn" onClick={() => toggle(r.id)}>{shown.has(r.id) ? "Hide" : "Show"}</button>
                </td>
                <td>{r.email || <span className="muted">—</span>}</td>
                <td><span className="badge">{r.role}</span></td>
                <td className="right">
                  <button className="link-btn" onClick={() => startEdit(r)}>Edit</button>
                  <button className="link-btn danger" onClick={() => remove(r)} disabled={r.id === meId}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
