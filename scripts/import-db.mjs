// One-time: copies your local data (data/db.json) into the hosted Neon database.
//   PowerShell:  $env:DATABASE_URL="postgresql://..."; node scripts/import-db.mjs
// Refuses to run if the hosted database already has accounts (add --force to overwrite everything).
import { readFileSync, existsSync } from "node:fs"
import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) { console.error("Set DATABASE_URL first (your Neon connection string)."); process.exit(1) }
if (!existsSync("data/db.json")) { console.error("No data/db.json here. Run this from the project folder."); process.exit(1) }

const data = JSON.parse(readFileSync("data/db.json", "utf8"))
const keys = ["accounts", "courses", "completions", "attendance", "redos", "guides", "schedule", "customRoles"]
const out = Object.fromEntries(keys.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]))

const sql = neon(url)
await sql.query("create table if not exists kv (key text primary key, value jsonb not null)")
const has = await sql.query("select 1 from kv where key = 'accounts'")
if (has.length && !process.argv.includes("--force")) {
  console.error("The hosted database already has data. Nothing was changed. (Use --force to overwrite it.)")
  process.exit(1)
}
await sql.query("insert into kv (key, value) select key, value from jsonb_each($1::jsonb) on conflict (key) do update set value = excluded.value", [JSON.stringify(out)])
console.log("Copied:", Object.entries(out).map(([k, v]) => `${k} (${Array.isArray(v) ? v.length : "-"})`).join(", "))
console.log("Done. Sign in on the hosted site with your usual admin login.")
console.log("Reminder: delete the demo accounts (volunteer, officer, seniorlead) on the Accounts page.")
