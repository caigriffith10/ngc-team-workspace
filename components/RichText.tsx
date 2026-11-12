"use client"

import { useEffect, useRef, useState } from "react"
import { sanitizeHtml } from "@/lib/sanitize"

function ToolBtn({ cmd, label, title, style, run, keep }: { cmd: string; label: string; title: string; style?: React.CSSProperties; run: (cmd: string) => void; keep: (e: React.MouseEvent) => void }) {
  return <button type="button" className="rt-btn" title={title} aria-label={title} style={style} onMouseDown={keep} onClick={() => run(cmd)}>{label}</button>
}

/**
 * A small Google-Docs-style editor: headings, bold/italic/underline, lists, quotes, links.
 * Everything it produces is cleaned again on the server before saving.
 */
export default function RichText({ value, onChange, onImport, placeholder = "Start typing...", minHeight }: {
  value: string
  onChange: (html: string) => void
  onImport?: () => void
  placeholder?: string
  minHeight?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const saved = useRef<Range | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState("https://")

  // Put the starting text in once, and again only if it changes from outside (like an import).
  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== value && document.activeElement !== el) el.innerHTML = value
  }, [value])

  const emit = () => { if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML)) }
  const run = (cmd: string, arg?: string) => { ref.current?.focus(); document.execCommand(cmd, false, arg); emit() }
  const keep = (e: React.MouseEvent) => e.preventDefault() // keeps the text selection while clicking toolbar buttons

  function block(tag: string) { run("formatBlock", tag) }

  function openLink() {
    const sel = window.getSelection()
    saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null
    setLinkOpen(true)
  }
  function applyLink() {
    let u = url.trim()
    if (u && !/^(https?:\/\/|mailto:)/i.test(u)) u = `https://${u}`
    ref.current?.focus()
    const sel = window.getSelection()
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current) }
    if (/^(https?:\/\/|mailto:)\S+$/i.test(u)) { document.execCommand("createLink", false, u); emit() }
    setLinkOpen(false)
    setUrl("https://")
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const html = e.clipboardData.getData("text/html")
    const text = e.clipboardData.getData("text/plain")
    if (html) document.execCommand("insertHTML", false, sanitizeHtml(html))
    else document.execCommand("insertText", false, text)
    emit()
  }

  return (
    <div className="rt">
      <div className="rt-bar" role="toolbar" aria-label="Text formatting">
        <select className="rt-select" aria-label="Text style" defaultValue="p" onChange={(e) => { block(e.target.value); e.target.value = "p" }}>
          <option value="p">Style…</option>
          <option value="p">Normal text</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <span className="rt-sep" />
        <ToolBtn run={run} keep={keep} cmd="bold" label="B" title="Bold (Ctrl+B)" />
        <ToolBtn run={run} keep={keep} cmd="italic" label="I" title="Italic (Ctrl+I)" style={{ fontStyle: "italic" }} />
        <ToolBtn run={run} keep={keep} cmd="underline" label="U" title="Underline (Ctrl+U)" style={{ textDecoration: "underline" }} />
        <span className="rt-sep" />
        <ToolBtn run={run} keep={keep} cmd="insertUnorderedList" label="• List" title="Bulleted list" />
        <ToolBtn run={run} keep={keep} cmd="insertOrderedList" label="1. List" title="Numbered list" />
        <button type="button" className="rt-btn" title="Quote" onMouseDown={keep} onClick={() => block("blockquote")}></button>
        <span className="rt-sep" />
        <button type="button" className="rt-btn" title="Add a link" onMouseDown={keep} onClick={openLink}>Link</button>
        <ToolBtn run={run} keep={keep} cmd="removeFormat" label="Tx" title="Clear formatting" />
        <ToolBtn run={run} keep={keep} cmd="undo" label="↶" title="Undo" />
        <ToolBtn run={run} keep={keep} cmd="redo" label="↷" title="Redo" />
        {onImport && <button type="button" className="rt-btn rt-claude" onMouseDown={keep} onClick={onImport}>Import from Claude</button>}
      </div>
      {linkOpen && (
        <div className="rt-link">
          <input className="input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink() } }} aria-label="Link address" />
          <button type="button" className="btn btn-green btn-sm" onClick={applyLink}>Add link</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setLinkOpen(false)}>Cancel</button>
        </div>
      )}
      <div
        ref={ref}
        className="rt-area rich"
        style={minHeight ? { minHeight } : undefined}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Text"
        data-placeholder={placeholder}
        onInput={emit}
        onPaste={onPaste}
      />
    </div>
  )
}
