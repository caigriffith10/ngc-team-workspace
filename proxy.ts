import { NextRequest, NextResponse } from "next/server"
import { COOKIE_NAME, verifySession } from "@/lib/auth"

export function proxy(request: NextRequest) {
  // API: refuse changes that were sent from another website (defense in depth on top of SameSite cookies).
  // Each API route still checks who you are and what you may do.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("origin")
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
      let sameSite = true
      if (origin) { try { sameSite = new URL(origin).host === host } catch { sameSite = false } }
      if (!sameSite) return NextResponse.json({ error: "Blocked: this request came from another website." }, { status: 403 })
    }
    return NextResponse.next()
  }
  if (!verifySession(request.cookies.get(COOKIE_NAME)?.value)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ["/dashboard/:path*", "/api/:path*"] }
