// Shared by the browser and the server. No Node imports here.

const ALLOWED_TAGS = new Set(["p", "br", "b", "strong", "i", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre", "a", "hr"])

const escapeText = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;")
export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * Keeps only a small set of harmless formatting tags and drops every attribute
 * (except a safe https/mailto link on <a>). Used on the server before saving
 * and again in the browser before showing, so pasted or imported text can't run code.
 */
export function sanitizeHtml(input: string, max = 60000): string {
  const src = String(input ?? "").slice(0, max)
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  let out = ""
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    out += escapeText(src.slice(last, m.index))
    last = m.index + m[0].length
    if (!m[2]) continue // a comment
    const closing = m[1] === "/"
    const tag = m[2].toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) continue
    if (closing) { if (tag !== "br" && tag !== "hr") out += `</${tag}>`; continue }
    if (tag === "a") {
      const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[3])
      const url = (href?.[1] ?? href?.[2] ?? "").trim()
      out += /^(https?:\/\/|mailto:)/i.test(url) ? `<a href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">` : "<a>"
    } else {
      out += `<${tag}>`
    }
  }
  out += escapeText(src.slice(last))
  return out
}

/** Old text blocks stored plain text with line breaks. */
export function plainToHtml(text: string): string {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
}

/** Turns simple Markdown (what Claude usually writes) into the formatting tags above. */
export function markdownToHtml(md: string): string {
  const lines = String(md ?? "").replace(/\r/g, "").split("\n")
  const out: string[] = []
  let list: "ul" | "ol" | null = null
  let para: string[] = []
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = [] } }
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (const raw of lines) {
    const line = raw.trimEnd()
    let m: RegExpExecArray | null
    if (!line.trim()) { flushPara(); closeList(); continue }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flushPara(); closeList(); out.push(`<h${m[1].length >= 3 ? 3 : 2}>${inline(m[2])}</h${m[1].length >= 3 ? 3 : 2}>`); continue }
    if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) { flushPara(); if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul" } out.push(`<li>${inline(m[1])}</li>`); continue }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { flushPara(); if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol" } out.push(`<li>${inline(m[1])}</li>`); continue }
    if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue }
    closeList()
    para.push(line)
  }
  flushPara(); closeList()
  return sanitizeHtml(out.join(""))
}

/** Plain-text version of formatted text, for short previews. */
export const htmlToText = (html: string) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim()

/** Formatted text as plain text with line breaks, for places that can't show formatting (like a mailto link). */
export function htmlToPlain(html: string): string {
  return String(html ?? "")
    .replace(/<li>/gi, "• ")
    .replace(/<\/(p|h2|h3|li|blockquote|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
