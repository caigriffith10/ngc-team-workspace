/** Turns a YouTube link into a safe embed URL. Returns null for anything else. */
export function youtubeEmbedUrl(input: string): string | null {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "")
  let id: string | null = null
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0]
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v")
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/)
      if (m) id = m[2]
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null
  return `https://www.youtube-nocookie.com/embed/${id}`
}
