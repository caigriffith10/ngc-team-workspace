"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/Header"
import { APP_NAME, CONTACT_EMAIL, GROUPME_NAME } from "@/lib/contact"

type View = "home" | "login" | "forgot"

export default function Home() {
  const [view, setView] = useState<View>("home")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push("/dashboard")
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Sign in failed.")
    } catch {
      setError("Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <Header />
      <main className="main">
        <div className="card-wrap">
          <div className="card">
            {view === "home" && (
              <>
                <div className="card-head">
                  <h1>{APP_NAME}</h1>
                  <p>Dashboard for NextGen Coderss Volunteers and Instructors</p>
                </div>
                <div className="card-body">
                  <button className="btn btn-block btn-green" onClick={() => setView("login")}>
                    User Login
                  </button>
                  <button className="btn btn-block btn-outline" onClick={() => setView("forgot")}>
                    Forgot Login
                  </button>
                </div>
              </>
            )}

            {view === "login" && (
              <>
                <div className="card-head">
                  <h1>User Login</h1>
                  <p>Sign in with the username and password from your admin</p>
                </div>
                <form className="card-body" onSubmit={handleLogin}>
                  <button type="button" className="btn-back" onClick={() => setView("home")}>
                    ← Back
                  </button>
                  <div className="field">
                    <label htmlFor="username">Username</label>
                    <input
                      id="username"
                      className="input"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="password">Password</label>
                    <div className="pw-wrap">
                      <input
                        id="password"
                        className="input"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        onClick={() => setShowPassword((s) => !s)}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <button type="submit" className="btn btn-block btn-green" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </button>
                </form>
              </>
            )}

            {view === "forgot" && (
              <>
                <div className="card-head">
                  <h1>Forgot Login</h1>
                  <p>We can&apos;t reset this online. Reach out any of these ways:</p>
                </div>
                <div className="card-body">
                  <button type="button" className="btn-back" onClick={() => setView("home")}>
                    ← Back
                  </button>
                  <ul className="help-list">
                    <li>Message {GROUPME_NAME}.</li>
                    <li>
                      Email the NextGen team at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                    </li>
                    <li>Or contact your admin directly.</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
