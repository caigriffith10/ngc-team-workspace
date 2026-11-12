"use client"

import { useState } from "react"
import { BUILT_IN_ROLES, CourseType, CustomRole, uid, useStoredList } from "@/lib/store"

export default function CourseTypesPage() {
  const { items, update } = useStoredList<CourseType>("ngc.courseTypes")
  const customRoles = useStoredList<CustomRole>("ngc.customRoles").items
  const roles = ["All volunteers", ...BUILT_IN_ROLES.map((r) => r.name), ...customRoles.map((r) => r.name)]

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [requiredFor, setRequiredFor] = useState("All volunteers")

  function add(e: React.FormEvent) {
    e.preventDefault()
    update([...items, { id: uid(), name: name.trim(), description: description.trim(), requiredFor }])
    setName("")
    setDescription("")
  }

  return (
    <>
      <div className="page-title">
        <h1>Course Types</h1>
        <p>Categories your courses belong to, and who has to take them.</p>
      </div>

      <form className="panel form-row" onSubmit={add}>
        <div className="field">
          <label htmlFor="cn">Course type</label>
          <input id="cn" className="input" required placeholder="Volunteer Basics" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field grow">
          <label htmlFor="cd">Description</label>
          <input id="cd" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cr">Required for</label>
          <select id="cr" className="input" value={requiredFor} onChange={(e) => setRequiredFor(e.target.value)}>
            {roles.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-green btn-inline">Add course type</button>
      </form>

      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Course type</th><th>Description</th><th>Required for</th><th /></tr></thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="muted center">No course types yet. Add your first one above.</td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.description || "—"}</td>
                <td><span className="badge">{c.requiredFor}</span></td>
                <td className="right">
                  <button className="link-btn danger" onClick={() => update(items.filter((x) => x.id !== c.id))}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
