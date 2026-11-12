import { NextResponse } from "next/server"
import { sanitizeHtml } from "@/lib/sanitize"
import { fail, guard } from "@/lib/session"

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/
const MAX_RECIPIENTS = 500

// Admin: send one message to a list of people through Resend (https://resend.com).
// Each person gets their own copy, so nobody sees anyone else's address.
// Needs RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local. Both are blank until you add them.
export async function POST(request: Request) {
  const g = await guard(true)
  if ("res" in g) return g.res

  const key = (process.env.RESEND_API_KEY ?? "").trim()
  const from = (process.env.RESEND_FROM_EMAIL ?? "").trim()
  if (!key || !from) return fail("Email sending isn't set up yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env.local, then restart the site.", 503)

  const b = await request.json().catch(() => ({}))
  const subject = typeof b.subject === "string" ? b.subject.trim().slice(0, 200) : ""
  const html = sanitizeHtml(typeof b.html === "string" ? b.html : "", 60000)
  const list: string[] = Array.isArray(b.to) ? b.to.filter((x: unknown): x is string => typeof x === "string").map((x: string) => x.trim()) : []
  const to = [...new Map(list.filter((e) => EMAIL.test(e)).map((e) => [e.toLowerCase(), e])).values()]

  if (!subject) return fail("Add a subject.")
  if (!html.replace(/<[^>]*>/g, "").trim()) return fail("Write a message.")
  if (to.length === 0) return fail("Add at least one email address.")
  if (to.length > MAX_RECIPIENTS) return fail(`That's more than ${MAX_RECIPIENTS} people at once. Send it in smaller groups.`)

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111">${html}</div>`
  let sent = 0
  try {
    for (let i = 0; i < to.length; i += 100) {
      const chunk = to.slice(i, i + 100)
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((addr) => ({ from, to: [addr], subject, html: body }))),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        const why = typeof detail?.message === "string" ? ` (${detail.message})` : ""
        return fail(`Resend didn't accept the email${why}. ${sent ? `${sent} of ${to.length} were sent before this.` : "Nothing was sent."}`, 502)
      }
      sent += chunk.length
    }
  } catch {
    return fail(`Couldn't reach Resend. ${sent ? `${sent} of ${to.length} were sent before this.` : "Nothing was sent."}`, 502)
  }
  return NextResponse.json({ sent })
}
