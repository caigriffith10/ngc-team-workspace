"use client"

import { useEffect } from "react"

/** Applies the signed-in person's saved light/dark choice (and remembers it on this device for the login page). */
export default function ThemeSync({ theme }: { theme?: "light" | "dark" }) {
  useEffect(() => {
    if (!theme) return
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark")
    else document.documentElement.removeAttribute("data-theme")
    try { localStorage.setItem("ngc.theme", theme) } catch {}
  }, [theme])
  return null
}
