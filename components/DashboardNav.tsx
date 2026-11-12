"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Header from "@/components/Header"

export default function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = role === "Admin"

  // Only the everyday pages live up here. Everything else is on the dashboard.
  const links = [
    { href: "/dashboard", label: "Dashboard", active: pathname === "/dashboard" },
    {
      href: "/dashboard/instructor-courses",
      label: "Instructor Courses",
      active: pathname.startsWith("/dashboard/instructor-courses") || pathname.startsWith("/dashboard/courses"),
    },
    { href: "/dashboard/schedule", label: "Schedule", active: pathname.startsWith("/dashboard/schedule") },
    { href: "/dashboard/program-guides", label: "Program Guides", active: pathname.startsWith("/dashboard/program-guides") },
  ]

  async function signOut() {
    await fetch("/api/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  return (
    <Header logoHref="/dashboard">
      <nav className="nav" aria-label="Main">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link${l.active ? " active" : ""}`}>{l.label}</Link>
        ))}
      </nav>
      <div className="nav-user">
        <Link href="/dashboard/settings" className={`nav-gear${pathname.startsWith("/dashboard/settings") ? " on" : ""}`} aria-label="Settings" title="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
        <button className="nav-signout" onClick={signOut}>Sign out</button>
      </div>
    </Header>
  )
}
