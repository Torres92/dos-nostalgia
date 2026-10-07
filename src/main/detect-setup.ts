import { readdirSync, readFileSync, statSync } from 'fs'
import { basename, extname, join } from 'path'
import JSZip from 'jszip'
import { createExtractorFromData } from 'node-unrar-js'
import { isSetupExecutable, pickSetupPath } from './pick-entry'
import { logger } from './logger'

/** Find SETUP/CONFIG in the same folder as a loose executable. */
export function detectSetupInDirectory(directory: string): string | null {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return null
  }

  const names: string[] = []
  for (const name of entries) {
    if (name.startsWith('.')) continue
    try {
      if (!statSync(join(directory, name)).isFile()) continue
    } catch {
      continue
    }
    if (isSetupExecutable(name)) names.push(name)
  }
  return pickSetupPath(names)
}

export async function detectSetupInZip(archivePath: string): Promise<string | null> {
  try {
    const loaded = await JSZip.loadAsync(readFileSync(archivePath))
    const names = Object.keys(loaded.files)
      .filter((name) => !loaded.files[name].dir)
      .map((name) => name.replace(/\\/g, '/'))
    const flattened = maybeFlattenNames(names)
    return pickSetupPath(flattened)
  } catch (err) {
    logger.warn('Could not peek zip for setup', {
      archivePath,
      message: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

export async function detectSetupInRar(archivePath: string): Promise<string | null> {
  try {
    const data = readFileSync(archivePath)
    let wasmBinary: ArrayBuffer | undefined
    try {
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      const wasmPath = require.resolve('node-unrar-js/dist/js/unrar.wasm')
      const wasm = readFileSync(wasmPath)
      wasmBinary = wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)
    } catch {
      wasmBinary = undefined
    }

    const extractor = await createExtractorFromData({
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      ...(wasmBinary ? { wasmBinary } : {})
    })
    const extracted = extractor.extract({})
    const names: string[] = []
    for (const file of extracted.files) {
      if (file.fileHeader.flags.directory) continue
      names.push(file.fileHeader.name.replace(/\\/g, '/'))
    }
    return pickSetupPath(maybeFlattenNames(names))
  } catch (err) {
    logger.warn('Could not peek rar for setup', {
      archivePath,
      message: err instanceof Error ? err.message : String(err)
    })
    return null
  }
}

export async function detectSetupForGamePath(
  gamePath: string,
  directory: string
): Promise<string | null> {
  const extension = extname(gamePath).toLowerCase()
  if (extension === '.zip') return detectSetupInZip(gamePath)
  // RAR peek extracts the whole archive — skip at scan time (too heavy).
  // Setup for .rar can be added later via on-demand detect.
  if (extension === '.rar') return null
  if (extension === '.exe' || extension === '.com' || extension === '.bat') {
    return detectSetupInDirectory(directory)
  }
  return null
}

/** Match build-bundle flattening so setup paths align with autoexec. */
function maybeFlattenNames(paths: string[]): string[] {
  const files = paths.filter((path) => !path.endsWith('/'))
  if (files.length === 0) return files

  const topLevelNames = new Set(
    files.map((path) => {
      const slashIndex = path.indexOf('/')
      return slashIndex === -1 ? '' : path.slice(0, slashIndex)
    })
  )

  const onlyTopLevel = [...topLevelNames]
  if (onlyTopLevel.length === 1 && onlyTopLevel[0] !== '') {
    const prefix = onlyTopLevel[0] + '/'
    return files.map((path) => (path.startsWith(prefix) ? path.slice(prefix.length) : path))
  }
  return files
}

export function setupDisplayName(setupPath: string | null): string {
  if (!setupPath) return 'SETUP'
  return basename(setupPath).toUpperCase()
}
