// Shared by the browser and the server. No Node imports here.
import { Completion, Course } from "./types"

export type CourseStatus = "todo" | "notpassed" | "awaiting" | "completed" | "redo"

/**
 * One status per person per course:
 *  redo       an admin asked them to take it again
 *  completed  passed, and an admin confirmed it
 *  awaiting   passed, waiting for an admin to confirm
 *  notpassed  tried, but hasn't passed yet
 *  todo       hasn't started
 */
export function courseStatus(list: Pick<Completion, "courseId" | "passed" | "confirmedAt" | "completedAt">[], courseId: string, redo: boolean): CourseStatus {
  if (redo) return "redo"
  const mine = list.filter((c) => c.courseId === courseId)
  if (mine.length === 0) return "todo"
  const passed = mine.filter((c) => c.passed).sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  if (passed.length === 0) return "notpassed"
  return passed[0].confirmedAt ? "completed" : "awaiting"
}

export const STATUS_LABEL: Record<CourseStatus, string> = {
  todo: "Not started",
  notpassed: "Not passed yet",
  awaiting: "Awaiting confirmation",
  completed: "Completed",
  redo: "Redo requested",
}
export const STATUS_TONE: Record<CourseStatus, string> = {
  todo: "gray",
  notpassed: "red",
  awaiting: "amber",
  completed: "green",
  redo: "orange",
}

type Targeting = Pick<Course, "published" | "roles" | "assignedTo">

/** True when the course is aimed at specific roles or people (so it's "required"). */
export const isTargeted = (c: Pick<Course, "roles" | "assignedTo">) => c.roles.length > 0 || c.assignedTo.length > 0

/** Does this person see this course? Unassigned courses are open to everyone. Admins see everything. */
export function isVisibleTo(c: Targeting, user: { id: string; role: string }): boolean {
  if (user.role === "Admin") return true
  if (!c.published) return false
  if (!isTargeted(c)) return true
  return c.roles.includes(user.role as never) || c.assignedTo.includes(user.id)
}

export const fmtMinutes = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, "0")}`
}
