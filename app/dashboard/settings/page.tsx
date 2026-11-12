"use client"

import { useEffect, useState } from "react"
import { api, send } from "@/lib/client"
import { PublicAccount } from "@/lib/types"

type Theme = "light" | "dark"

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("light")
  const [me, setMe] = useState<PublicAccount | null>(null)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light")
    api<PublicAccount>("/api/me").then((m) => { setMe(m); setUsername(m.username); setDisplayName(m.name) }).catch(() => {})
  }, [])

  function chooseTheme(t: Theme) {
    setTheme(t)
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark")
    else document.documentElement.removeAttribute("data-theme")
    try { localStorage.setItem("ngc.theme", t) } catch {}
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    try {
      const m = await api<PublicAccount>("/api/me", send("PATCH", { name: displayName }))
      setMe(m)
      setMsg({ ok: true, text: "Name updated. The dashboard will greet you with it." })
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }) }
  }

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    try {
      const m = await api<PublicAccount>("/api/me", send("PATCH", { username }))
      setMe(m)
      setMsg({ ok: true, text: "Username updated." })
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }) }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    try {
      await api("/api/me", send("PATCH", { currentPassword: current, newPassword: next }))
      setCurrent("")
      setNext("")
      setMsg({ ok: true, text: "Password updated." })
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }) }
  }

  return (
    <main className="dash-main">
      <div className="page-title"><div><h1>Settings</h1><p>{me ? `${me.name} · ${me.role}` : ""}</p></div></div>

      <section className="panel setting">
        <h2>Appearance</h2>
        <div className="theme-options">
          <button className={`theme-option${theme === "light" ? " on" : ""}`} onClick={() => chooseTheme("light")}> Light mode</button>
          <button className={`theme-option${theme === "dark" ? " on" : ""}`} onClick={() => chooseTheme("dark")}> Dark mode</button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>Saved on this device.</p>
      </section>

      <section className="panel setting">
        <h2>Username and password</h2>
        <div className="notice warn" style={{ margin: 0 }}>
          <strong>Admin accounts can view your username and passwords.</strong>{" "}
          Don&apos;t reuse a password from anywhere else.
        </div>
        {msg && <div className={msg.ok ? "notice" : "notice warn"} style={{ margin: 0 }}>{msg.text}</div>}

        <form onSubmit={saveName} style={{ display: "contents" }}>
          <div className="field">
            <label htmlFor="dn">Display name</label>
            <input id="dn" className="input" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div><button className="btn btn-green btn-inline" type="submit">Change name</button></div>
        </form>

        <hr style={{ border: 0, borderTop: "1px solid var(--border)", width: "100%" }} />

        <form onSubmit={saveUsername} style={{ display: "contents" }}>
          <div className="field">
            <label htmlFor="un">Username</label>
            <input id="un" className="input" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div><button className="btn btn-green btn-inline" type="submit">Change username</button></div>
        </form>

        <hr style={{ border: 0, borderTop: "1px solid var(--border)", width: "100%" }} />

        <form onSubmit={savePassword} style={{ display: "contents" }}>
          <div className="field">
            <label htmlFor="cp">Current password</label>
            <input id="cp" type="password" className="input" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="field">
            <label htmlFor="np">New password (min 6)</label>
            <input id="np" type="password" className="input" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <div><button className="btn btn-green btn-inline" type="submit">Change password</button></div>
        </form>
      </section>
    </main>
  )
}
