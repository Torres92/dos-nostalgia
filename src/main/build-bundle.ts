import { readFileSync, readdirSync, statSync } from 'fs'
import { basename, extname, join } from 'path'
import JSZip from 'jszip'
import { createExtractorFromData } from 'node-unrar-js'
import type { GameEntry, LaunchMode } from '../shared/types'
import { pickEntryCommand, pathToEntryCommand, pickSetupPath, isSetupExecutable } from './pick-entry'
import { logger } from './logger'

export interface BuiltBundle {
  bytes: Uint8Array
  entryCommand: string
  ega: boolean
  fileCount: number
}

/** Keen 4–6 (Galaxy) — EGA ATR / hardware pel-panning games. */
function isKeenGalaxy(fileNames: string[], title: string): boolean {
  const haystack = `${title}\n${fileNames.join('\n')}`.toLowerCase()
  if (fileNames.some((name) => /(?:^|\/)keen[456][a-z]?\.(?:exe|com)$/i.test(name))) return true
  if (fileNames.some((name) => /\.ck[456]$/i.test(name))) return true
  if (fileNames.some((name) => /egagraph\./i.test(name))) return true
  if (
    /keen\s*[456]|goodbye,? galaxy|armageddon machine|alien(?:s)?\s*ate\s*my\s*baby\s*sitter/i.test(
      haystack
    )
  ) {
    return true
  }
  return false
}

/** Keen 1–3 (Vorticons): VGA at 70 Hz scrolls steadier than EGA’s 60 Hz. */
function isKeenVorticons(fileNames: string[], title: string): boolean {
  if (isKeenGalaxy(fileNames, title)) return false
  const haystack = `${title}\n${fileNames.join('\n')}`.toLowerCase()
  if (fileNames.some((name) => /(?:^|\/)keen[123]\.(?:exe|com)$/i.test(name))) return true
  if (fileNames.some((name) => /\.ck[123]$/i.test(name))) return true
  if (/vorticon|marooned on mars|earth explodes|keen must die|invasion of the vorticons/i.test(haystack)) {
    return true
  }
  return false
}

/** Keen 4–6 need EGA ATR on plain dosbox; Galaxy still prefers EGA machine flag for bundle metadata. */
function shouldUseEga(fileNames: string[], title: string): boolean {
  const haystack = `${title}\n${fileNames.join('\n')}`.toLowerCase()
  if (isKeenVorticons(fileNames, title)) return false
  if (isKeenGalaxy(fileNames, title)) return true
  if (/commander\s*keen|\bkeen\b/i.test(haystack)) return true
  return false
}

/**
 * Shooters / flight games that read relative mouse deltas (need Pointer Lock).
 * Point-and-click, SimCity, strategy UIs want absolute mouse — leave autolock off.
 */
function needsRelativeMouse(fileNames: string[], title: string): boolean {
  const haystack = `${title}\n${fileNames.join('\n')}`.toLowerCase()
  if (/\brap(?:tor)?\b|rap\.exe|call of the shadows/i.test(haystack)) return true
  if (/\bdoom\b|doom2|heretic|hexen|strife/i.test(haystack)) return true
  if (/wolfenstein|wolf3d|spear of destiny/i.test(haystack)) return true
  if (/duke.?nukem|duke3d|blood\b|shadow warrior/i.test(haystack)) return true
  if (/quake|descent|wing commander|x.?wing|tie fighter/i.test(haystack)) return true
  return false
}

/**
 * Keen Galaxy scroll hitch: EGA emulates ~60 Hz while the engine times to ~70 Hz,
 * so newly revealed map strips hitch/shake. VGA-only runs at 70 Hz (DOSBox-X).
 * /NOPAN was tried; its 8px jumps look like shake when tiles enter/leave view.
 */
function buildDosboxConf(
  entryCommand: string,
  opts: {
    ega: boolean
    keenGalaxy?: boolean
    cycles?: string
    core?: string
    setupOutro?: boolean
    /** Relative-mouse games need lock in play; SETUP UI needs absolute mouse. */
    autolock?: boolean
  }
): string {
  const keenGalaxy = Boolean(opts.keenGalaxy)
  const machine = keenGalaxy ? 'vgaonly' : opts.ega ? 'ega' : 'svga_s3'
  const core = opts.core ?? (opts.ega || keenGalaxy ? 'normal' : 'auto')
  // Galaxy: fixed mid cycles; classic EGA Keen timing band is ~2200.
  const cycles =
    opts.cycles ?? (keenGalaxy ? 'fixed 3000' : opts.ega ? 'fixed 2200' : 'auto')
  const cpuType = opts.ega && !keenGalaxy ? 'cputype=386_slow\n' : ''
  const autolock = Boolean(opts.autolock)
  const outro = opts.setupOutro
    ? `
echo.
echo ****************************************
echo * SETUP TERMINADO
echo * Usa los botones de la ventana:
echo *  [Guardar y jugar]
echo *  [Guardar y volver]
echo ****************************************
echo.
`
    : ''

  return `[sdl]
autolock=${autolock ? 'true' : 'false'}

[dosbox]
machine=${machine}
memsize=16

[cpu]
core=${core}
${cpuType}cycles=${cycles}

[dos]
ems=true
xms=true
umb=true

[render]
aspect=false
scaler=none

[mixer]
rate=22050

[autoexec]
@echo off
mount c .
c:
${entryCommand}
${outro}`
}

/** If every file lives under one top-level folder, flatten to ZIP root. */
function maybeFlattenPaths(paths: string[]): Map<string, string> {
  const mapping = new Map<string, string>()
  const files = paths.filter((path) => !path.endsWith('/'))
  if (files.length === 0) return mapping

  const topLevelNames = new Set(
    files.map((path) => {
      const slashIndex = path.indexOf('/')
      return slashIndex === -1 ? '' : path.slice(0, slashIndex)
    })
  )

  const onlyTopLevel = [...topLevelNames]
  if (onlyTopLevel.length === 1 && onlyTopLevel[0] !== '') {
    const prefix = onlyTopLevel[0] + '/'
    for (const path of files) {
      mapping.set(path, path.slice(prefix.length))
    }
    return mapping
  }

  for (const path of files) mapping.set(path, path)
  return mapping
}

async function zipDirectoryContents(
  zip: JSZip,
  directory: string,
  entryFile: string
): Promise<void> {
  const MAX_FILES = 4000
  const MAX_BYTES = 512 * 1024 * 1024
  let fileCount = 0
  let totalBytes = 0

  const walk = (dir: string, prefix: string): void => {
    const entries = readdirSync(dir)
    for (const name of entries) {
      if (name.startsWith('.')) continue
      const fullPath = join(dir, name)
      let stats
      try {
        stats = statSync(fullPath)
      } catch {
        continue
      }
      const zipPath = prefix ? `${prefix}/${name}` : name
      if (stats.isDirectory()) {
        walk(fullPath, zipPath)
        continue
      }
      if (!stats.isFile()) continue
      if (fileCount >= MAX_FILES) {
        throw new Error(`La carpeta del juego tiene demasiados archivos (máx. ${MAX_FILES}).`)
      }
      if (totalBytes + stats.size > MAX_BYTES) {
        throw new Error('La carpeta del juego supera el límite de tamaño para empaquetar.')
      }
      zip.file(zipPath, readFileSync(fullPath))
      fileCount += 1
      totalBytes += stats.size
    }
  }

  walk(directory, '')

  if (!zip.file(entryFile) && !zip.file(entryFile.toUpperCase())) {
    zip.file(entryFile, readFileSync(join(directory, entryFile)))
  }
}

async function wrapFileMap(
  files: Map<string, Uint8Array>,
  title: string,
  mode: LaunchMode = 'play',
  preferredSetupPath?: string | null
): Promise<BuiltBundle> {
  const sourceNames = [...files.keys()]
  const flattenMap = maybeFlattenPaths(sourceNames)

  const wrap = new JSZip()
  const outNames: string[] = []
  for (const [sourcePath, destPath] of flattenMap) {
    const data = files.get(sourcePath)
    if (!data) continue
    wrap.file(destPath, data)
    outNames.push(destPath)
  }

  let entryCommand: string
  if (mode === 'setup') {
    const setupRel =
      preferredSetupPath && outNames.some((n) => n.replace(/\\/g, '/') === preferredSetupPath)
        ? preferredSetupPath
        : pickSetupPath(outNames)
    if (!setupRel) {
      throw new Error(
        'No se encontró SETUP/CONFIG en este juego. Descomprimí el archivo en una carpeta si hace falta.'
      )
    }
    entryCommand = pathToEntryCommand(setupRel)
  } else {
    entryCommand = pickEntryCommand(outNames, title)
  }

  const ega = shouldUseEga(outNames, title)
  const keenGalaxy = isKeenGalaxy(outNames, title)
  const relativeMouse = mode !== 'setup' && needsRelativeMouse(outNames, title)
  logger.info('Bundle entry selected', {
    title,
    mode,
    entryCommand,
    ega,
    keenGalaxy,
    relativeMouse,
    machine: keenGalaxy ? 'vgaonly' : ega ? 'ega' : 'svga_s3',
    fileCount: outNames.length
  })
  wrap.folder('.jsdos')!.file(
    'dosbox.conf',
    buildDosboxConf(entryCommand, {
      ega,
      keenGalaxy,
      setupOutro: mode === 'setup',
      autolock: relativeMouse
    })
  )
  const bytes = await wrap.generateAsync({ type: 'uint8array' })
  return { bytes, entryCommand, ega, fileCount: outNames.length }
}

async function wrapPlainZip(
  existing: Buffer,
  title: string,
  mode: LaunchMode = 'play',
  preferredSetupPath?: string | null
): Promise<BuiltBundle> {
  const loaded = await JSZip.loadAsync(existing)
  const files = new Map<string, Uint8Array>()
  for (const [name, file] of Object.entries(loaded.files)) {
    if (file.dir) continue
    files.set(name.replace(/\\/g, '/'), await file.async('uint8array'))
  }
  return wrapFileMap(files, title, mode, preferredSetupPath)
}

async function wrapRarArchive(
  archivePath: string,
  title: string,
  mode: LaunchMode = 'play',
  preferredSetupPath?: string | null
): Promise<BuiltBundle> {
  const data = readFileSync(archivePath)
  // electron-vite bundles main; pass wasm explicitly so unrar works in production.
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
  const files = new Map<string, Uint8Array>()
  // Must consume the full iterator to avoid a native memory leak in node-unrar-js.
  for (const file of extracted.files) {
    if (file.fileHeader.flags.directory || !file.extraction) continue
    const name = file.fileHeader.name.replace(/\\/g, '/')
    files.set(name, file.extraction)
  }
  if (files.size === 0) {
    throw new Error('El archivo .rar no contiene archivos extraíbles.')
  }
  return wrapFileMap(files, title, mode, preferredSetupPath)
}

export async function buildGameBundle(
  game: GameEntry,
  mode: LaunchMode = 'play',
  entryOverride: string | null = null
): Promise<BuiltBundle> {
  const extension = extname(game.path).toLowerCase()
  const preferredSetup = game.setupPath
  const override =
    entryOverride && entryOverride.trim() ? basename(entryOverride.trim()) : null

  if (extension === '.zip') {
    const existing = readFileSync(game.path)
    const loaded = await JSZip.loadAsync(existing)
    // Ignore prebuilt js-dos wrappers; rebuild a plain DOS zip for the launcher.
    if (loaded.folder('.jsdos')?.file('dosbox.conf')) {
      const plain = new JSZip()
      for (const [name, file] of Object.entries(loaded.files)) {
        if (file.dir || name.startsWith('.jsdos/') || name === 'dosbox.conf') continue
        plain.file(name, await file.async('uint8array'))
      }
      const buffer = await plain.generateAsync({ type: 'nodebuffer' })
      return wrapPlainZip(buffer, game.title, mode, preferredSetup)
    }
    return wrapPlainZip(existing, game.title, mode, preferredSetup)
  }

  if (extension === '.rar') {
    return wrapRarArchive(game.path, game.title, mode, preferredSetup)
  }

  if (extension === '.jsdos') {
    throw new Error(
      'Los paquetes .jsdos ya no están soportados. Usa .zip / .rar / .exe / .com / .bat.'
    )
  }

  // Folder / loose executable — optional entryOverride picks a specific EXE inside the dir.
  const zip = new JSZip()
  const directory = game.directory
  let entryFile: string | null = override

  if (!entryFile) {
    entryFile =
      mode === 'setup'
        ? preferredSetup
          ? basename(preferredSetup)
          : pickSetupPath(
              readdirSync(directory).filter((n) => {
                try {
                  return statSync(join(directory, n)).isFile()
                } catch {
                  return false
                }
              })
            )
        : game.filename
  }

  if (!entryFile) {
    throw new Error(
      mode === 'setup'
        ? 'No se encontró SETUP/CONFIG en la carpeta del juego.'
        : 'No se encontró el ejecutable del juego.'
    )
  }

  const resolvedEntry = entryFile
  await zipDirectoryContents(zip, directory, resolvedEntry)
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir)
  const entryCommand = pathToEntryCommand(resolvedEntry)
  const ega = shouldUseEga(names, game.title)
  const keenGalaxy = isKeenGalaxy(names, game.title)
  const isSetupLaunch =
    mode === 'setup' || Boolean(override && isSetupExecutable(override))
  const relativeMouse = !isSetupLaunch && needsRelativeMouse(names, game.title)
  logger.info('Bundle entry selected', {
    title: game.title,
    mode,
    entryOverride: override,
    entryCommand,
    ega,
    keenGalaxy,
    relativeMouse,
    machine: keenGalaxy ? 'vgaonly' : ega ? 'ega' : 'svga_s3',
    fileCount: names.length,
    source: 'loose-executable'
  })
  zip.folder('.jsdos')!.file(
    'dosbox.conf',
    buildDosboxConf(entryCommand, {
      ega,
      keenGalaxy,
      setupOutro: isSetupLaunch,
      autolock: relativeMouse
    })
  )
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  return { bytes, entryCommand, ega, fileCount: names.length }
}
