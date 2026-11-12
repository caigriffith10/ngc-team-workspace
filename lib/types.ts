// Shared by the browser and the server. No Node imports here.

export const BUILT_IN_ROLES = ["Admin", "In Training", "Volunteer", "Officer", "Senior Lead"] as const
/** A role is just its name: the built-in ones above, or a custom role an admin made. */
export type Role = string

/** Things a role can be allowed to do. Admins can always do all of them. */
export const PERMISSIONS = [
  { id: "editGuides", label: "Write and edit Program Guides", hint: "Create, edit and delete guides, and see every guide." },
  { id: "viewAttendance", label: "See Instructor Attendance", hint: "Open the instructor attendance sheet and see everyone's accounts." },
] as const
export type Permission = (typeof PERMISSIONS)[number]["id"]

/** A role an admin made, with the permissions paired to it. */
export type RoleDef = { id: string; name: string; permissions: Permission[] }

/** Permissions of the built-in roles. Admin gets everything; the others get nothing extra. */
const BUILT_IN_PERMISSIONS: Record<string, Permission[]> = { "Senior Lead": ["editGuides", "viewAttendance"] }
export const permissionsOfBuiltIn = (role: string): Permission[] =>
  role === "Admin" ? PERMISSIONS.map((p) => p.id) : BUILT_IN_PERMISSIONS[role] ?? []

export function permissionsOf(role: string, custom: RoleDef[]): Permission[] {
  if ((BUILT_IN_ROLES as readonly string[]).includes(role)) return permissionsOfBuiltIn(role)
  return custom.find((r) => r.name === role)?.permissions ?? []
}

/** Every role name a course or guide can be aimed at (admins don't take courses). */
export const assignableRoles = (custom: RoleDef[]): string[] => [...BUILT_IN_ROLES.filter((r) => r !== "Admin"), ...custom.map((r) => r.name)]

/** Can this person open this guide? Empty roles and assignedTo means everyone. */
export function canSeeGuide(g: { roles: string[]; assignedTo: string[] }, user: { id: string; role: string }, canEdit: boolean): boolean {
  if (canEdit) return true
  if (g.roles.length === 0 && g.assignedTo.length === 0) return true
  return g.roles.includes(user.role) || g.assignedTo.includes(user.id)
}

/** The only things NextGen teaches. */
export const PROGRAMS = [
  { id: "python", name: "Python", url: "https://cs50.dev" },
  { id: "javascript", name: "JavaScript", url: "" },
  { id: "csp", name: "CSP (Code.org)", url: "https://code.org" },
  { id: "scratch", name: "Scratch", url: "https://scratch.mit.edu" },
] as const
export type ProgramId = (typeof PROGRAMS)[number]["id"]
export const programName = (id: string) => PROGRAMS.find((p) => p.id === id)?.name ?? ""
export const isProgramId = (v: unknown): v is ProgramId => PROGRAMS.some((p) => p.id === v)

export type Account = {
  id: string
  name: string
  username: string
  email: string
  role: Role
  password: string // encrypted at rest, see lib/crypto.ts (admins can view it)
  createdAt: string
}

/** What the browser is allowed to see about an account. */
export type PublicAccount = Omit<Account, "password">
/** The signed-in person: their account plus what their role lets them do. */
export type Me = PublicAccount & { permissions: Permission[] }

/** correct holds the index (or indexes, when multi is true) of the right answer(s). */
export type Question = { id: string; question: string; options: string[]; correct: number[]; multi: boolean }

export type Block =
  | { id: string; type: "text"; html: string }
  | { id: string; type: "image"; src: string; alt: string; caption: string }
  | { id: string; type: "video"; url: string }
  | { id: string; type: "file"; name: string; mime: string; size: number; data: string } // a document for learners to download
  | { id: string; type: "quiz"; title: string; questions: Question[] }
  | { id: string; type: "upload"; prompt: string } // learner must upload a file
  | { id: string; type: "response"; prompt: string } // learner must write an answer

export type CoursePage = { id: string; title: string; blocks: Block[] }

export type Course = {
  id: string
  title: string
  type: string
  program: ProgramId | "" // "" = all programs
  description: string
  minMinutes: number | null // minimum time spent before a learner may submit
  published: boolean
  roles: Role[] // required for these roles
  assignedTo: string[] // required for these individual accounts
  pages: CoursePage[]
  createdAt: string
  updatedAt: string
}

export type SubmittedFile = { blockId: string; name: string; mime: string; size: number; data: string }

export type Completion = {
  id: string
  userId: string
  courseId: string
  completedAt: string
  score: number
  total: number
  passed: boolean
  timeSpentSec: number
  answers: Record<string, number[]>
  responses: Record<string, string>
  files: SubmittedFile[]
  /** A passed attempt counts as "awaiting confirmation" until an admin confirms it. */
  confirmedAt: string | null
  confirmedBy: string | null
}

/** The lightweight version sent in lists (no answers, text or file contents). */
export type CompletionSummary = Pick<Completion, "id" | "userId" | "courseId" | "completedAt" | "score" | "total" | "passed" | "timeSpentSec" | "confirmedAt"> & {
  fileCount: number
  responseCount: number
}

/** A plain "please redo this course" flag from an admin. No penalty: nothing is removed or blocked. */
export type Redo = { userId: string; courseId: string; note: string; createdAt: string }

/** A day on the schedule. Admins build the schedule (by hand or by importing from Claude). */
export type ScheduleDay = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  startTime: string // "HH:MM" 24h, or ""
  endTime: string
  location: string
  notes: string
}


export type GuideFile = { id: string; name: string; mime: string; size: number; data: string }

export type Guide = {
  id: string
  title: string
  program: ProgramId | ""
  summary: string
  html: string
  files: GuideFile[]
  /** Who can see it. Both empty = everyone. Admins and Senior Leads always see every guide. */
  roles: Role[]
  assignedTo: string[]
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}

/** Files learners and admins may upload. Anything else (html, svg, scripts) is refused. */
export const ALLOWED_MIMES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "text/plain": "Text",
  "text/csv": "CSV",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/zip": "ZIP",
}
export const MAX_FILE_BYTES = 3_000_000
export const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"

export const PASS_PERCENT = 80
export const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
