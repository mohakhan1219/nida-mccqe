import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

/**
 * Restores today/journey/workspace from zlib staging ONLY when the working
 * tree still has stub/placeholder product files. Never overwrite real feature
 * work on a development branch.
 */
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const manifestPath = join(root, '.cursor/phase1-restore/manifest.json')

if (!existsSync(manifestPath)) {
  console.log('phase1-assemble: no staging manifest; skip')
  process.exit(0)
}

const man = JSON.parse(readFileSync(manifestPath, 'utf8'))

function looksLikeStub(path, minBytes = 1000) {
  if (!existsSync(path)) return true
  const text = readFileSync(path, 'utf8')
  if (text.includes('PLACEHOLDER_WILL_FAIL')) return true
  if (text.includes('$file:')) return true
  if (text.length < minBytes) return true
  // Temporary loading stub used during Phase 1 deploy recovery
  if (text.includes('Loading today') && text.length < 400) return true
  return false
}

let restored = 0
for (const [key, meta] of Object.entries(man)) {
  const dest = join(root, meta.dest)
  if (!looksLikeStub(dest, key === 'workspace' ? 20000 : 8000)) {
    console.log(`phase1-assemble: keep existing ${meta.dest}`)
    continue
  }
  const staging = join(root, meta.staging)
  if (!existsSync(staging)) {
    throw new Error(`Missing staging blob for ${key}: ${meta.staging}`)
  }
  const b64 = readFileSync(staging, 'utf8').trim()
  const data = inflateSync(Buffer.from(b64, 'base64'))
  const sha256 = createHash('sha256').update(data).digest('hex')
  if (sha256 !== meta.sha256) {
    throw new Error(`${key} sha256 mismatch: ${sha256} != ${meta.sha256}`)
  }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, data)
  restored += 1
  console.log(`restored ${meta.dest} (${data.length} bytes)`)
}

console.log(restored ? `phase1-assemble: OK (${restored} restored)` : 'phase1-assemble: OK (nothing to restore)')
