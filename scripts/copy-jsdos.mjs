import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { dirname, join, sep } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'js-dos', 'dist')
const dest = join(root, 'src', 'renderer', 'public', 'js-dos')

if (!existsSync(src)) {
  console.warn('[copy-jsdos] js-dos no está instalado; se omite la copia.')
  process.exit(0)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dirname(dest), { recursive: true })
cpSync(src, dest, {
  recursive: true,
  filter: (source) => {
    const lower = source.toLowerCase()
    if (lower.endsWith('.map') || lower.endsWith('.symbols') || lower.endsWith('.d.ts')) {
      return false
    }
    // Skip TypeScript declaration trees shipped in the dist package.
    const typesSegment = `${sep}types${sep}`.toLowerCase()
    const typesTail = `${sep}types`.toLowerCase()
    if (lower.includes(typesSegment) || lower.endsWith(typesTail)) {
      return false
    }
    return true
  }
})
console.log('[copy-jsdos] Assets copiados a src/renderer/public/js-dos (sin maps/types)')
