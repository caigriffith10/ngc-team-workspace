import { BUILT_IN_ROLES, PERMISSIONS, Permission, RoleDef } from "./types"

export const cleanRoleName = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 40)

export const cleanPermissions = (v: unknown): Permission[] =>
  PERMISSIONS.map((p) => p.id).filter((id) => Array.isArray(v) && v.includes(id))

/** Why a role name can't be used, or "" if it's fine. */
export function badRoleName(name: string, others: RoleDef[], selfId?: string): string {
  if (name.length < 2) return "Give the role a name (at least 2 letters)."
  const taken: string[] = [...BUILT_IN_ROLES, ...others.filter((r) => r.id !== selfId).map((r) => r.name)]
  if (taken.some((t) => t.toLowerCase() === name.toLowerCase())) return "A role with that name already exists."
  return ""
}
