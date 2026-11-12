import fs from "node:fs"
import path from "node:path"
import { encryptPassword } from "./crypto"
import { Account, Completion, Course, Guide, Redo, RoleDef, ScheduleDay, uid } from "./types"

/*
 * Storage. Two modes, same data shape:
 *  - DATABASE_URL (or POSTGRES_URL) set  -> Neon/Postgres, one row per top-level key in table `kv`. Use this on Vercel.
 *  - not set                              -> one JSON file at data/db.json (local development).
 * Only this file knows which one is in use.
 *
 * readDB("accounts", "guides") loads just those parts (faster, and avoids pulling every uploaded file);
 * await readDB() loads everything. await writeDB(db) saves only the parts that changed since they were read.
 */
export type DB = {
  accounts: Account[]
  courses: Course[]
  completions: Completion[]
  attendance: unknown[] // old in-app attendance records. Kept so nothing is lost, no longer used.
  redos: Redo[]
  guides: Guide[]
  schedule: ScheduleDay[]
  customRoles: RoleDef[]
  /** Failed-login counters (see app/api/login). Keys look like ip:1.2.3.4 or user:name. */
  throttle: Record<string, { count: number; resetAt: number }>
}

function seed(): DB {
  const now = new Date().toISOString()
  const adminPw = process.env.ADMIN_INITIAL_PASSWORD
  if (!adminPw) throw new Error("ADMIN_INITIAL_PASSWORD is missing (see .env.example)")
  // On a hosted database the admin account must never start with the well-known local default.
  if (databaseUrl() && (adminPw === "nextgencodersadmin" || adminPw.length < 10)) {
    throw new Error("Set ADMIN_INITIAL_PASSWORD to a new password of at least 10 characters before the first visit (see HOW-TO-RUN.txt).")
  }
  const mk = (name: string, username: string, role: Account["role"], pw: string): Account => ({
    id: uid(), name, username, email: "", role, password: encryptPassword(pw), createdAt: now,
  })
  const sampleCourse: Course = {
    id: uid(), title: "Volunteer Basics (sample)", type: "Volunteer Basics", program: "",
    description: "A tiny example course so you can see how the player works. Delete it any time.",
    minMinutes: null, published: true, roles: [], assignedTo: [], createdAt: now, updatedAt: now,
    pages: [
      { id: uid(), title: "Welcome", blocks: [
        { id: uid(), type: "text", html: "<h2>Welcome to NextGen Coders</h2><p>NextGen Coders teaches coding to Middle Georgia students. As an instructor, you help make every class welcoming and safe.</p>" },
      ] },
      { id: uid(), title: "Quick check", blocks: [
        { id: uid(), type: "quiz", title: "Check your understanding", questions: [
          { id: uid(), question: "Who does NextGen Coders teach?", options: ["Middle Georgia students", "Only college students", "Only adults"], correct: [0], multi: false },
          { id: uid(), question: "Which of these are a volunteer's jobs? (select all that apply)", options: ["Make every class welcoming and safe", "Help students who are stuck", "Skip the class"], correct: [0, 1], multi: true },
        ] },
      ] },
    ],
  }
  return {
    accounts: [
      mk("Admin", (process.env.ADMIN_USERNAME ?? "admin").toLowerCase(), "Admin", adminPw),
      // Demo logins so every role can be tried on your own computer. Never created on a hosted database.
      ...(databaseUrl() ? [] : [
        mk("Demo Volunteer", "volunteer", "Volunteer", "ngc-volunteer"),
        mk("Demo Officer", "officer", "Officer", "ngc-officer"),
        mk("Demo Senior Lead", "seniorlead", "Senior Lead", "ngc-seniorlead"),
      ]),
    ],
    courses: [sampleCourse],
    completions: [],
    attendance: [],
    redos: [],
    guides: [],
    schedule: [],
    customRoles: [],
    throttle: {},
  }
}

/** Brings data saved by older versions up to the current shape. Safe to run every time, on whichever parts were loaded. */
function migrate(db: any): any {
  for (const g of db.guides ?? []) { g.roles ??= []; g.assignedTo ??= [] }
  for (const c of db.courses ?? []) {
    c.minMinutes ??= null
    delete c.timeLimitMin // replaced by minimum time spent
    c.program ??= ""
    c.roles ??= []
    c.assignedTo ??= []
    for (const p of c.pages ?? []) {
      for (const b of p.blocks ?? []) {
        if (b.type === "text" && typeof b.html !== "string") {
          const t = String(b.text ?? "")
          const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          const paras = esc.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("")
          b.html = b.style === "heading" ? `<h2>${esc.replace(/\n/g, " ")}</h2>` : paras
          delete b.text
          delete b.style
        }
        if (b.type === "quiz") {
          for (const q of b.questions ?? []) {
            if (!Array.isArray(q.correct)) q.correct = [Number(q.correct) || 0]
            q.multi ??= false
          }
        }
      }
    }
  }
  for (const x of db.completions ?? []) {
    x.timeSpentSec ??= 0
    x.answers ??= {}
    x.responses ??= {}
    x.files ??= []
    x.confirmedAt ??= null
    x.confirmedBy ??= null
  }
  return db
}

const KEYS = ["accounts", "courses", "completions", "attendance", "redos", "guides", "schedule", "customRoles", "throttle"] as const satisfies readonly (keyof DB)[]
type Key = (typeof KEYS)[number]

/** What each loaded object looked like when it was read, so writeDB can save only what changed. */
const loaded = new WeakMap<object, Partial<Record<Key, string>>>()

// ---------- Postgres (Neon) ----------
type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>
let querier: Query | null = null
let tableReady: Promise<unknown> | null = null

/** Test hook: lets a script run the Postgres code against an in-process database. */
export function _setQueryForTests(q: Query | null) { querier = q; tableReady = null }

async function query(text: string, params: unknown[] = []) {
  if (!querier) {
    const { neon } = await import("@neondatabase/serverless")
    const run = neon(databaseUrl())
    querier = (t, p) => run.query(t, p) as Promise<Record<string, unknown>[]>
  }
  tableReady ??= querier("create table if not exists kv (key text primary key, value jsonb not null)")
  await tableReady
  return querier(text, params)
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || ""
}

async function pgRead(keys: readonly Key[]): Promise<Record<string, unknown>> {
  const fetchRows = () => query("select key, value from kv where key in (select jsonb_array_elements_text($1::jsonb))", [JSON.stringify(keys)])
  let rows = await fetchRows()
  if (!(await query("select 1 from kv where key = 'accounts'")).length) {
    // Brand-new database: create the admin and the sample course. "do nothing" keeps two first visits from clobbering each other.
    await query("insert into kv (key, value) select key, value from jsonb_each($1::jsonb) on conflict (key) do nothing", [JSON.stringify(seed())])
    rows = await fetchRows()
  }
  return Object.fromEntries(rows.map((r) => [r.key as string, r.value]))
}

// ---------- JSON file (local) ----------
const FILE = path.join(process.cwd(), "data", "db.json")

function fileRead(): Record<string, unknown> {
  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set. On Vercel add it under Settings > Environment Variables (see HOW-TO-RUN.txt), then redeploy.")
  if (!fs.existsSync(FILE)) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fileWrite(seed())
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8"))
}

function fileWrite(db: unknown) {
  const tmp = FILE + ".tmp"
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, FILE) // swap in whole file so a crash can't leave half-written data
}

// ---------- public API ----------
export function readDB(): Promise<DB>
export function readDB<K extends Key>(...keys: K[]): Promise<Pick<DB, K>>
export async function readDB(...keys: Key[]): Promise<any> {
  const want: readonly Key[] = keys.length ? keys : KEYS
  const raw = databaseUrl() || querier ? await pgRead(want) : fileRead()
  const db: Record<string, unknown> = {}
  for (const k of want) db[k] = raw[k] ?? (k === "throttle" ? {} : [])
  migrate(db)
  loaded.set(db, Object.fromEntries(want.map((k) => [k, JSON.stringify(db[k])])))
  return db
}

/** Saves what changed. Pass the object you got from readDB. */
export async function writeDB(db: Partial<DB>) {
  const before = loaded.get(db) ?? {}
  const changed: Record<string, unknown> = {}
  for (const k of KEYS) {
    if (!(k in before)) continue
    if (JSON.stringify(db[k]) !== before[k]) changed[k] = db[k]
  }
  if (Object.keys(changed).length === 0) return
  if (databaseUrl() || querier) {
    await query("insert into kv (key, value) select key, value from jsonb_each($1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(changed)])
  } else {
    const all = fileRead()
    fileWrite({ ...all, ...changed })
  }
  for (const k of Object.keys(changed)) before[k as Key] = JSON.stringify(changed[k])
}
