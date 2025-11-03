// Simple deployment self-check script
// Usage: BASE_URL=https://your-domain pnpm deploy:selfcheck

const base = process.env.BASE_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'

const targets = [
  '/api/health',
  '/api/stripe-notify',
  '/api/hitem3d/callback',
]

function log(msg) { console.log(`[selfcheck] ${msg}`) }

async function check(path) {
  const url = base.replace(/\/$/, '') + path
  const res = await fetch(url)
  log(`${path} -> ${res.status}`)
  if (!res.ok) throw new Error(`${path} not OK: ${res.status}`)
}

async function main() {
  log(`Base URL: ${base}`)
  for (const t of targets) {
    await check(t)
  }
  log('All checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

