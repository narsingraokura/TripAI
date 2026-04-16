// Runs via setupFiles — loads .env.local into process.env before test module code executes.
const fs = require("fs")
const path = require("path")

const envFile = path.join(__dirname, ".env.local")
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, "utf-8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    process.env[key] = value
  }
}
