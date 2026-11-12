"use client"

import { useEffect, useState } from "react"
import RichText from "@/components/RichText"
import { api, send } from "@/lib/client"
import { htmlToText } from "@/lib/sanitize"

type Person = { id: string; name: string; role: string; email?: string }

const EMAIL = /[^\s,;<>()"']+@[^\s,;<>()"']+\.[^\s,;<>()"']+/g

export default function ClassEmail() {
  const [emails, setEmails] = useState<string[]>([])
  const [noEmail, setNoEmail] = useState(0)
  const [paste, setPaste] = useState("")
  const [skipped, setSkipped] = useState(0)
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  function add(list: string[]) {
    setEmails((cur) => {
      const have = new Set(cur.map((e) => e.toLowerCase()))
      const next = [...cur]
      for (const e of list) if (!have.has(e.toLowerCase())) { have.add(e.toLowerCase()); next.push(e) }
      return next
    })
  }

  // Every instructor with an email on their account is added automatically. Accounts with no email are skipped.
  function addInstructors(people: Person[]) {
    const withEmail = people.filter((p) => p.email && p.email.trim())
    setNoEmail(people.length - withEmail.length)
    add(withEmail.map((p) => p.email!.trim()))
  }
  const [people, setPeople] = useState<Person[]>([])
  useEffect(() => { api<Person[]>("/api/people").then((p) => { setPeople(p); addInstructors(p) }).catch(() => {}) }, [])

  // Collects every address in whatever was pasted: commas, spaces, new lines, "Name <a@b.com>", a copied spreadsheet column.
  function collect() {
    const found = paste.match(EMAIL) ?? []
    const rough = paste.split(/[\s,;]+/).filter((x) => x.includes("@")).length
    add(found)
    setSkipped(Math.max(0, rough - found.length))
    setPaste("")
  }

  const ready = emails.length > 0 && subject.trim() !== "" && htmlToText(html) !== ""

  async function sendNow() {
    setBusy(true); setResult(null)
    try {
      const r = await api<{ sent: number }>("/api/send-email", send("POST", { to: emails, subject, html }))
      setResult({ ok: true, text: `Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}.` })
      setConfirming(false)
    } catch (e) { setResult({ ok: false, text: (e as Error).message }); setConfirming(false) } finally { setBusy(false) }
  }

  return (
    <main className="dash-main">
      <div className="page-title">
        <div>
          <h1>Send Class Email</h1>
          <p>Write one message and send it to the whole class.</p>
        </div>
      </div>

      <div className="panel email-box">
        <section>
          <h2>To</h2>
          <p className="hint" style={{ marginTop: "-.4rem" }}>
            Instructors are added automatically from the email on each account{noEmail > 0 ? `. ${noEmail} account${noEmail === 1 ? " has" : "s have"} no email, so ${noEmail === 1 ? "it was" : "they were"} skipped` : ""}.
          </p>
          <div className="field">
            <label htmlFor="paste">Add more addresses</label>
            <textarea id="paste" className="input" rows={2} placeholder="Paste addresses here, separated by commas, spaces or new lines. A copied spreadsheet column works too." value={paste} onChange={(e) => setPaste(e.target.value)} />
          </div>
          <div className="btn-row">
            <button className="btn btn-green btn-sm" onClick={collect} disabled={!paste.trim()}>Add addresses</button>
            <button className="btn btn-outline btn-sm" onClick={() => addInstructors(people)}>Add all instructors</button>
            {emails.length > 0 && <button className="btn btn-outline btn-sm" onClick={() => { setEmails([]); setSkipped(0) }}>Clear all</button>}
          </div>
          {skipped > 0 && <p className="hint">{skipped} item{skipped === 1 ? "" : "s"} didn&apos;t look like an email address and {skipped === 1 ? "was" : "were"} skipped.</p>}
          <div className="chips" style={{ marginTop: ".25rem" }} aria-live="polite">
            {emails.length === 0 && <span className="muted" style={{ fontSize: ".9rem" }}>No addresses yet.</span>}
            {emails.map((e) => <span key={e} className="chip">{e}<button aria-label={`Remove ${e}`} onClick={() => setEmails(emails.filter((x) => x !== e))}>✕</button></span>)}
          </div>
          {emails.length > 0 && <p className="hint">{emails.length} recipient{emails.length === 1 ? "" : "s"}. Each person gets their own copy, so nobody sees anyone else&apos;s address.</p>}
        </section>

        <section>
          <h2>Message</h2>
          <div className="field"><label htmlFor="subj">Subject</label><input id="subj" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="field">
            <label>Message</label>
            <RichText value={html} onChange={setHtml} minHeight="14rem" placeholder="Write your message here, like in a document…" />
          </div>
        </section>

        <section>
          {result && <div className={result.ok ? "notice" : "notice warn"} style={{ marginBottom: 0 }} role="status">{result.text}</div>}
          <div className="btn-row">
            {confirming ? (
              <>
                <button className="btn btn-green" onClick={sendNow} disabled={busy}>{busy ? "Sending..." : `Yes, send to ${emails.length}`}</button>
                <button className="btn btn-outline" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              </>
            ) : (
              <button className="btn btn-green" disabled={!ready} onClick={() => { setResult(null); setConfirming(true) }}>Send Email</button>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
