"use client"

import { useState } from "react"
import { api, send } from "@/lib/client"
import { PERMISSIONS, Permission } from "@/lib/types"
import { RoleInfo, useRoles } from "@/lib/useRoles"

const BUILT_IN_NOTE: Record<string, string> = {
  Admin: "Full access to everything. Can't be changed.",
  "In Training": "New members. Takes their assigned courses and reads guides.",
  Volunteer: "Takes their assigned courses and reads guides.",
  Officer: "Takes their assigned courses and reads guides.",
  "Senior Lead": "Leadership. Writes guides and sees Instructor Attendance.",
}

function PermChecks({ value, onChange, disabled }: { value: Permission[]; onChange?: (v: Permission[]) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".35rem" }}>
      {PERMISSIONS.map((p) => (
        <label key={p.id} className="chk-row" title={p.hint}>
          <input type="checkbox" disabled={disabled} checked={value.includes(p.id)} onChange={(e) => onChange?.(e.target.checked ? [...value, p.id] : value.filter((x) => x !== p.id))} />
          {p.label}
        </label>
      ))}
    </div>
  )
}

export default function RolesPage() {
  const { builtIn, custom, reload } = useRoles()
  const [name, setName] = useState("")
  const [perms, setPerms] = useState<Permission[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setError(""); setBusy(true)
    try { await fn(); await reload() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => { await api("/api/roles", send("POST", { name, permissions: perms })); setName(""); setPerms([]) })
  }
  const setPermsFor = (r: RoleInfo, permissions: Permission[]) => run(() => api(`/api/roles/${r.id}`, send("PATCH", { permissions })))
  const rename = () => renaming && run(async () => { await api(`/api/roles/${renaming.id}`, send("PATCH", { name: renaming.name })); setRenaming(null) })
  const remove = (r: RoleInfo) => { if (confirm(`Delete the role "${r.name}"?`)) void run(() => api(`/api/roles/${r.id}`, send("DELETE"))) }

  return (
    <main className="dash-main wide">
      <div className="page-title">
        <div>
          <h1>Roles</h1>
          <p>Make your own roles (like Python Instructor) and choose what each one is allowed to do. Give a role to someone on the Accounts page.</p>
        </div>
      </div>

      <form className="panel card-pad" style={{ gap: "1rem", padding: "1.25rem", marginBottom: "1.25rem" }} onSubmit={add}>
        <h3 style={{ margin: 0 }}>New role</h3>
        <div className="field" style={{ maxWidth: "24rem" }}>
          <label htmlFor="rn">Role name</label>
          <input id="rn" className="input" required maxLength={40} placeholder="Python Instructor" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>What can this role do?</label>
          <PermChecks value={perms} onChange={setPerms} />
          <span className="hint">Every role can already take courses, read the guides it&apos;s allowed to see and use the Schedule. Tick only the extras.</span>
        </div>
        <div className="btn-row"><button type="submit" className="btn btn-green" disabled={busy}>＋ Add role</button></div>
        {error && <p className="form-error">{error}</p>}
      </form>

      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Role</th><th>Can do</th><th>People</th><th /></tr></thead>
          <tbody>
            {builtIn.map((r) => (
              <tr key={r.name}>
                <td><span className="badge">{r.name}</span><div className="muted" style={{ fontSize: ".8rem", marginTop: ".3rem" }}>{BUILT_IN_NOTE[r.name]}</div></td>
                <td><PermChecks value={r.permissions} disabled /></td>
                <td>{r.members}</td>
                <td className="right muted">Built-in</td>
              </tr>
            ))}
            {custom.map((r) => (
              <tr key={r.id}>
                <td>
                  {renaming && renaming.id === r.id ? (
                    <div className="btn-row">
                      <input className="input" style={{ width: "12rem" }} aria-label="Role name" maxLength={40} value={renaming.name} onChange={(e) => setRenaming({ id: r.id!, name: e.target.value })} />
                      <button className="btn btn-green btn-sm" onClick={rename} disabled={busy}>Save</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setRenaming(null)}>Cancel</button>
                    </div>
                  ) : <span className="badge badge-custom">{r.name}</span>}
                </td>
                <td><PermChecks value={r.permissions} onChange={(v) => void setPermsFor(r, v)} disabled={busy} /></td>
                <td>{r.members}</td>
                <td className="right">
                  <button className="link-btn" onClick={() => setRenaming({ id: r.id!, name: r.name })}>Rename</button>
                  <button className="link-btn danger" onClick={() => remove(r)}>Delete</button>
                </td>
              </tr>
            ))}
            {custom.length === 0 && <tr><td colSpan={4} className="muted center">No custom roles yet. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  )
}
