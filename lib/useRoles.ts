"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "./client"
import { BUILT_IN_ROLES, Permission } from "./types"

export type RoleInfo = { name: string; permissions: Permission[]; members: number; id?: string }

/** The live list of roles (built-in plus custom). Falls back to the built-in names until it loads. */
export function useRoles() {
  const [builtIn, setBuiltIn] = useState<RoleInfo[]>(BUILT_IN_ROLES.map((name) => ({ name, permissions: [], members: 0 })))
  const [custom, setCustom] = useState<RoleInfo[]>([])
  const load = useCallback(() => api<{ builtIn: RoleInfo[]; custom: RoleInfo[] }>("/api/roles").then((r) => { setBuiltIn(r.builtIn); setCustom(r.custom) }).catch(() => {}), [])
  useEffect(() => { void load() }, [load])
  const all = [...builtIn, ...custom].map((r) => r.name)
  return { builtIn, custom, all, assignable: all.filter((n) => n !== "Admin"), reload: load }
}
