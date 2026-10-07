import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve, sep } from 'path'
import JSZip from 'jszip'
import { isPathInside } from './paths'
import { logger } from './logger'

export interface DiskFileWrite {
  relativePath: string
  data: Uint8Array
}

function safeRelativePath(name: string): string | null {
  let normalized = name.replace(/\\/g, '/').replace(/^\/+/, '')
  // js-dos FS trees often use "C:/file" or "./file"
  normalized = normalized.replace(/^[a-zA-Z]:\//, '').replace(/^\.\//, '')
  if (!normalized || normalized.includes('..')) return null
  if (normalized.startsWith('.jsdos/')) return null
  return normalized
}

/**
 * Write a js-dos persist zip back into a game folder on disk.
 */
export async function applyPersistedChangesToDirectory(
  targetDirectory: string,
  zipBytes: Uint8Array
): Promise<{ written: number; files: string[] }> {
  const root = resolve(targetDirectory)
  const loaded = await JSZip.loadAsync(zipBytes)
  const files: DiskFileWrite[] = []

  for (const [name, file] of Object.entries(loaded.files)) {
    if (file.dir) continue
    const relativePath = safeRelativePath(name)
    if (!relativePath) continue
    files.push({
      relativePath,
      data: await file.async('uint8array')
    })
  }

  return writeFilesToDirectory(root, files)
}

/** Write individual files extracted from the emulator FS. */
export function writeFilesToDirectory(
  targetDirectory: string,
  files: DiskFileWrite[]
): { written: number; files: string[] } {
  const root = resolve(targetDirectory)
  const writtenFiles: string[] = []

  for (const file of files) {
    const relativePath = safeRelativePath(file.relativePath)
    if (!relativePath) continue

    const dest = resolve(join(root, ...relativePath.split('/')))
    if (!isPathInside(root, dest)) {
      logger.warn('Skipped write path outside game folder', { relativePath, dest })
      continue
    }

    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, file.data)
    writtenFiles.push(relativePath.replace(/\//g, sep))
  }

  logger.info('Wrote emulator files to disk', {
    targetDirectory: root,
    written: writtenFiles.length,
    files: writtenFiles.slice(0, 30)
  })

  return { written: writtenFiles.length, files: writtenFiles }
}
