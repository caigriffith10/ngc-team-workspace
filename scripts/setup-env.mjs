// Runs automatically before dev/build/start. Creates .env.local the first time only (on your own computer).
// Skipped on Vercel and anywhere AUTH_SECRET is already provided: there the settings come from the host's Environment Variables.
import { existsSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"

if (process.env.VERCEL || process.env.AUTH_SECRET) {
  console.log("Using environment variables from the host (skipping .env.local).")
} else if (!existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    `AUTH_SECRET=${randomBytes(32).toString("base64")}\nADMIN_USERNAME=admin\nADMIN_INITIAL_PASSWORD=nextgencodersadmin\n`,
  )
  console.log("Created .env.local (first run).")
}
