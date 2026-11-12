"use client"

import { useState } from "react"
import ImportModal from "@/components/ImportModal"
import { api, send } from "@/lib/client"
import { ScheduleDay, uid } from "@/lib/types"

const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const sortDays = (list: ScheduleDay[]) => [...list].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const dow = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDay()

const blank = { date: "", title: "", startTime: "", endTime: "", location: "", notes: "", repeat: false, until: "", weekdays: [] as number[] }

export default function ScheduleEditor({ days, onSaved }: { days: ScheduleDay[]; onSaved: (days: ScheduleDay[]) => void }) {
  const [draft, setDraft] = useState<ScheduleDay[]>(days)
  const [dirty, setDirty] = useState(false)
  const [importing, setImporting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blank)
  const [formErr, setFormErr] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const patch = (id: string, p: Partial<ScheduleDay>) => { setDraft((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x))); setDirty(true); setMsg(null) }

  function openAdd() {
    const last = draft.length ? draft[draft.length - 1].date : ""
    setForm({ ...blank, date: last ? addDays(last, 7) : todayISO() })
    setFormErr("")
    setAdding(true)
  }

  function addFromForm() {
    if (!form.date) { setFormErr("Pick a date."); return }
    if (form.repeat && (!form.until || form.until < form.date)) { setFormErr("Pick an end date that is on or after the first date."); return }
    const dates: string[] = []
    if (form.repeat) {
      const want = new Set(form.weekdays.length ? form.weekdays : [dow(form.date)])
      for (let d = form.date; d <= form.until && dates.length < 300; d = addDays(d, 1)) if (want.has(dow(d))) dates.push(d)
      if (!dates.length) { setFormErr("No matching days between those dates."); return }
    } else dates.push(form.date)
    const fresh: ScheduleDay[] = dates.map((date) => ({ id: uid(), date, title: form.title.trim(), startTime: form.startTime, endTime: form.endTime, location: form.location.trim(), notes: form.notes.trim() }))
    setDraft(sortDays([...draft, ...fresh]))
    setDirty(true)
    setAdding(false)
    setMsg({ ok: true, text: `Added ${fresh.length} day${fresh.length === 1 ? "" : "s"}. Click Save to keep ${fresh.length === 1 ? "it" : "them"}.` })
  }

  function addImported(list: ScheduleDay[]) {
    const have = new Set(draft.map((d) => `${d.date}|${d.title}`))
    const fresh = list.filter((d) => !have.has(`${d.date}|${d.title}`)).map((d) => ({ ...d, id: uid() }))
    setDraft(sortDays([...draft, ...fresh]))
    setDirty(true)
    setImporting(false)
    setMsg({ ok: true, text: `Added ${fresh.length} day${fresh.length === 1 ? "" : "s"}${list.length - fresh.length ? ` (${list.length - fresh.length} already on the list)` : ""}. Click Save to keep them.` })
  }

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const saved = await api<ScheduleDay[]>("/api/schedule", send("PUT", { days: draft }))
      setDraft(saved); setDirty(false)
      setMsg({ ok: true, text: "Saved." })
      onSaved(saved)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="toolbar">
        <p className="muted" style={{ margin: 0 }}>Everyone sees these days on the Schedule.</p>
        <div className="btn-row">
          <button className="btn btn-outline" onClick={openAdd}>＋ Add day</button>
          <button className="btn btn-green" onClick={save} disabled={busy || !dirty}>{busy ? "Saving..." : "💾 Save"}</button>
          <button className="btn btn-outline" onClick={() => setImporting(true)}>✨ Import from Claude</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? "notice" : "notice warn"}>{msg.text}</div>}

      {adding && (
        <div className="panel card-pad add-day">
          <h3>Add a day</h3>
          <div className="add-day-grid">
            <div className="field"><label htmlFor="ad-date">Date</label><input id="ad-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="field grow"><label htmlFor="ad-title">Title</label><input id="ad-title" className="input" placeholder="NextGen Coders Meeting" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field"><label htmlFor="ad-start">Start</label><input id="ad-start" type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div className="field"><label htmlFor="ad-end">End</label><input id="ad-end" type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            <div className="field grow"><label htmlFor="ad-loc">Location</label><input id="ad-loc" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="field grow"><label htmlFor="ad-notes">Notes</label><input id="ad-notes" className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="btn-row" style={{ alignItems: "center" }}>
            <label className="chk-row">
              <input type="checkbox" checked={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.checked, weekdays: e.target.checked && !form.weekdays.length && form.date ? [dow(form.date)] : form.weekdays, until: e.target.checked && !form.until && form.date ? addDays(form.date, 84) : form.until })} />
              Repeat every week until
            </label>
            <input type="date" className="input" style={{ width: "auto" }} aria-label="Repeat until" disabled={!form.repeat} min={form.date} value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} />
          </div>
          {form.repeat && (
            <div className="btn-row" style={{ alignItems: "center" }}>
              <span className="muted">On:</span>
              {form.weekdays.map((w, i) => (
                <span key={i} style={{ display: "inline-flex", gap: ".25rem", alignItems: "center" }}>
                  <select className="input" style={{ width: "auto" }} aria-label={`Weekday ${i + 1}`} value={w} onChange={(e) => setForm({ ...form, weekdays: form.weekdays.map((x, j) => (j === i ? +e.target.value : x)) })}>
                    {DAY_NAMES.map((n, k) => <option key={k} value={k}>{n}</option>)}
                  </select>
                  {form.weekdays.length > 1 && <button type="button" className="tool danger" title="Remove this day" onClick={() => setForm({ ...form, weekdays: form.weekdays.filter((_, j) => j !== i) })}>✕</button>}
                </span>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm({ ...form, weekdays: [...form.weekdays, (form.weekdays[form.weekdays.length - 1] ?? 0) + 1 > 6 ? 0 : (form.weekdays[form.weekdays.length - 1] ?? 0) + 1] })}>＋ Add another day</button>
            </div>
          )}
          {formErr && <p className="form-error">{formErr}</p>}
          <div className="btn-row">
            <button className="btn btn-green" onClick={addFromForm}>{form.repeat ? "Add repeating days" : "Add day"}</button>
            <button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel table-wrap">
        <table className="table sched-edit">
          <thead><tr><th>Date</th><th>Title</th><th>Start</th><th>End</th><th>Location</th><th>Notes</th><th /></tr></thead>
          <tbody>
            {draft.length === 0 && <tr><td colSpan={7} className="muted center">No days yet. Add one, or import a whole schedule from Claude.</td></tr>}
            {draft.map((d) => (
              <tr key={d.id}>
                <td><input type="date" className="input" aria-label="Date" value={d.date} onChange={(e) => patch(d.id, { date: e.target.value })} /></td>
                <td><input className="input" aria-label="Title" placeholder="NextGen Coders Meeting" value={d.title} onChange={(e) => patch(d.id, { title: e.target.value })} /></td>
                <td><input type="time" className="input" aria-label="Start time" value={d.startTime} onChange={(e) => patch(d.id, { startTime: e.target.value })} /></td>
                <td><input type="time" className="input" aria-label="End time" value={d.endTime} onChange={(e) => patch(d.id, { endTime: e.target.value })} /></td>
                <td><input className="input" aria-label="Location" value={d.location} onChange={(e) => patch(d.id, { location: e.target.value })} /></td>
                <td><input className="input" aria-label="Notes" value={d.notes} onChange={(e) => patch(d.id, { notes: e.target.value })} /></td>
                <td className="right"><button className="tool danger" title="Remove day" onClick={() => { setDraft(draft.filter((x) => x.id !== d.id)); setDirty(true) }}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importing && <ImportModal kind="schedule" onClose={() => setImporting(false)} onDays={addImported} />}
    </>
  )
}
