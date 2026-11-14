import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const man = JSON.parse(readFileSync(join(root, '.cursor/phase1-restore/manifest.json'), 'utf8'))

for (const [key, meta] of Object.entries(man)) {
  const b64 = readFileSync(join(root, meta.staging), 'utf8').trim()
  const data = inflateSync(Buffer.from(b64, 'base64'))
  const sha256 = createHash('sha256').update(data).digest('hex')
  if (sha256 !== meta.sha256) {
    throw new Error(`${key} sha256 mismatch: ${sha256} != ${meta.sha256}`)
  }
  const dest = join(root, meta.dest)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, data)
  console.log(`restored ${meta.dest} (${data.length} bytes)`)
}
console.log('phase1-assemble: OK')
