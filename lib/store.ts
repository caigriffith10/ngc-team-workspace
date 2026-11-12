"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * PROTOTYPE storage: keeps lists in this browser's localStorage.
 * Replace with a real database (Supabase) in the next milestone.
 */
export function useStoredList<T>(key: string) {
  const [items, setItems] = useState<T[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
    setReady(true)
  }, [key])

  const update = useCallback(
    (next: T[]) => {
      setItems(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}
    },
    [key],
  )

  return { items, update, ready }
}

export type Account = { id: string; name: string; username: string; role: string; createdAt: string }
export type CustomRole = { id: string; name: string; description: string }
export type CourseType = { id: string; name: string; description: string; requiredFor: string }

export const BUILT_IN_ROLES = [
  { name: "Admin", description: "Full access. Creates accounts, course types and roles." },
  { name: "In Training", description: "New members. Same access as a Volunteer." },
  { name: "Volunteer", description: "Default role. Completes the training assigned to them." },
  { name: "Officer", description: "Unlocked after finishing every basic volunteer course." },
  { name: "Senior Lead", description: "Leadership role. Permissions to be defined." },
] as const

export const uid = () => Math.random().toString(36).slice(2, 10)
