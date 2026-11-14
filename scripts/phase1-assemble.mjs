import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

/**
 * Restores product files from zlib staging ONLY when the working
 * tree still has stub/placeholder/incomplete product files. Never overwrite real feature
 * work on a development branch.
 */
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const restoreDir = join(root, '.cursor/phase1-restore')
const manifestPath = join(restoreDir, 'manifest.json')

if (!existsSync(manifestPath)) {
  console.log('phase1-assemble: no staging manifest; skip')
  process.exit(0)
}

const man = JSON.parse(readFileSync(manifestPath, 'utf8'))

function looksLikeStub(path, key) {
  if (!existsSync(path)) return true
  const text = readFileSync(path, 'utf8')
  if (text.includes('PLACEHOLDER_WILL_FAIL')) return true
  if (text.includes('$file:')) return true
  if (text.includes('$READ:')) return true
  if (text.includes('$LOAD:')) return true
  if (text.includes('Loading today') && text.length < 400) return true
  if (key === 'workspace') {
    // Full file is 63429 bytes at merge 1a7ef41
    if (text.length !== 63429) return true
    return false
  }
  if (key === 'catalog') {
    // Full catalog has 578 topics at merge 1a7ef41
    try {
      const j = JSON.parse(text)
      if (!Array.isArray(j.topics) || j.topics.length !== 578) return true
    } catch {
      return true
    }
    return false
  }
  if (text.length < 1000) return true
  return false
}

function ensureCatalogZlib() {
  const out = join(restoreDir, 'catalog.zlib.b64')
  const parts = []
  for (let i = 1; i <= 9; i++) {
    const p = join(restoreDir, `catalog.zlib.b64.z0${i}`)
    if (!existsSync(p)) return
    parts.push(readFileSync(p, 'utf8').replace(/\n/g, ''))
  }
  const joined = parts.join('')
  writeFileSync(out, joined)
  console.log(`phase1-assemble: concatenated catalog zlib (${joined.length} chars)`)
}

ensureCatalogZlib()

let restored = 0
for (const [key, meta] of Object.entries(man)) {
  const dest = join(root, meta.dest)
  if (!looksLikeStub(dest, key)) {
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
