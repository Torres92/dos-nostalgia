import { readdirSync, statSync, existsSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { GameEntry, GAME_EXTENSIONS, ScanResult } from '../shared/types'
import {
  isPrimaryPlayExecutable,
  isUtilityExecutable,
  pickPlayExecutableName
} from './pick-entry'
import { detectSetupInDirectory, detectSetupInZip } from './detect-setup'
import { logger } from './logger'

const COVER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

function isGameFile(fileName: string): boolean {
  const extension = extname(fileName).toLowerCase()
  return (GAME_EXTENSIONS as readonly string[]).includes(extension)
}

function prettyTitle(fileName: string): string {
  const stem = basename(fileName, extname(fileName))
  return stem
    .replace(/[_]+/g, ' ')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function findCover(
  titleStem: string,
  gameDirectory: string,
  coversFolder: string
): string | null {
  const candidateDirectories = [coversFolder, join(gameDirectory, 'covers'), gameDirectory].filter(
    (path) => path && existsSync(path)
  )

  const stemVariants = [
    titleStem,
    titleStem.toLowerCase(),
    titleStem.replace(/\s+/g, ''),
    titleStem.replace(/\s+/g, '-'),
    titleStem.replace(/\s+/g, '_')
  ]

  for (const directory of candidateDirectories) {
    let entries: string[] = []
    try {
      entries = readdirSync(directory)
    } catch {
      continue
    }
    for (const stem of stemVariants) {
      for (const extension of COVER_EXTENSIONS) {
        const match = entries.find(
          (entry) => entry.toLowerCase() === `${stem.toLowerCase()}${extension}`
        )
        if (match) {
          return join(directory, match)
        }
      }
    }
  }
  return null
}

function listDirectoryNames(directory: string): string[] {
  try {
    return readdirSync(directory).filter((name) => !name.startsWith('.'))
  } catch {
    return []
  }
}

function pushArchiveGame(
  games: GameEntry[],
  fullPath: string,
  coversFolder: string,
  setupPath: string | null
): void {
  const extension = extname(fullPath).toLowerCase()
  const name = basename(fullPath)
  const title = prettyTitle(name)
  const directory = resolve(fullPath, '..')
  const coverPath = findCover(basename(name, extension), directory, coversFolder)

  games.push({
    id: fullPath,
    title,
    filename: name,
    path: fullPath,
    kind: extension === '.rar' ? 'rar' : 'zip',
    coverPath,
    coverUrl: coverPath ? pathToFileURL(coverPath).href : null,
    directory,
    hasSetup: Boolean(setupPath),
    setupPath
  })
}

function pushFolderGame(
  games: GameEntry[],
  directory: string,
  playFileName: string,
  coversFolder: string,
  setupPath: string | null
): void {
  const title = prettyTitle(basename(directory))
  const playPath = join(directory, playFileName)
  const coverPath =
    findCover(basename(directory), directory, coversFolder) ??
    findCover(basename(playFileName, extname(playFileName)), directory, coversFolder)

  games.push({
    id: directory,
    title,
    filename: playFileName,
    path: playPath,
    kind: 'folder',
    coverPath,
    coverUrl: coverPath ? pathToFileURL(coverPath).href : null,
    directory,
    hasSetup: Boolean(setupPath),
    setupPath
  })
}

function pushLooseExecutable(
  games: GameEntry[],
  fullPath: string,
  coversFolder: string,
  setupPath: string | null
): void {
  const name = basename(fullPath)
  const extension = extname(name)
  const title = prettyTitle(name)
  const directory = resolve(fullPath, '..')
  const coverPath = findCover(basename(name, extension), directory, coversFolder)

  games.push({
    id: fullPath,
    title,
    filename: name,
    path: fullPath,
    kind: 'executable',
    coverPath,
    coverUrl: coverPath ? pathToFileURL(coverPath).href : null,
    directory,
    hasSetup: Boolean(setupPath),
    setupPath
  })
}

/**
 * Library model:
 * - Each subfolder with a playable EXE = one game (folder title), Play + optional Setup
 * - Root-level .zip / .rar = one game each
 * - Loose EXEs only at library root when there is a single playable EXE (edge case)
 * - Help/catalog/BBS extras are not listed as separate games
 */
async function collectGames(rootDirectory: string, coversFolder: string): Promise<GameEntry[]> {
  const games: GameEntry[] = []
  let folderGames = 0
  let skippedExtras = 0
  let skippedRootLooseExes = 0

  const visit = async (currentDirectory: string, isRoot: boolean): Promise<void> => {
    const names = listDirectoryNames(currentDirectory)
    const files: string[] = []
    const subdirs: string[] = []

    for (const name of names) {
      const fullPath = join(currentDirectory, name)
      let stats
      try {
        stats = statSync(fullPath)
      } catch {
        continue
      }
      if (stats.isDirectory()) {
        if (name.toLowerCase() === 'covers') continue
        subdirs.push(name)
      } else if (stats.isFile() && isGameFile(name)) {
        files.push(name)
      }
    }

    const playFiles = files.filter((name) => isPrimaryPlayExecutable(name))
    const archiveFiles = files.filter((name) => {
      const ext = extname(name).toLowerCase()
      return ext === '.zip' || ext === '.rar'
    })
    const extraFiles = files.filter(
      (name) =>
        isUtilityExecutable(name) &&
        !archiveFiles.includes(name) &&
        (extname(name).toLowerCase() === '.exe' ||
          extname(name).toLowerCase() === '.com' ||
          extname(name).toLowerCase() === '.bat')
    )
    skippedExtras += extraFiles.length

    // Unpacked game folder: one library row for the whole directory.
    if (!isRoot && playFiles.length > 0) {
      const title = prettyTitle(basename(currentDirectory))
      const playName = pickPlayExecutableName(playFiles, title) ?? playFiles[0]
      const setupPath = detectSetupInDirectory(currentDirectory)
      pushFolderGame(games, currentDirectory, playName, coversFolder, setupPath)
      folderGames += 1
      // Still surface nested archives if someone nested a zip inside the game folder.
      for (const archiveName of archiveFiles) {
        const fullPath = join(currentDirectory, archiveName)
        const setupPathArchive =
          extname(archiveName).toLowerCase() === '.zip'
            ? await detectSetupInZip(fullPath)
            : null
        pushArchiveGame(games, fullPath, coversFolder, setupPathArchive)
      }
      return
    }

    // Container / library root: list archives, recurse into subfolders.
    for (const archiveName of archiveFiles) {
      const fullPath = join(currentDirectory, archiveName)
      const setupPathArchive =
        extname(archiveName).toLowerCase() === '.zip' ? await detectSetupInZip(fullPath) : null
      pushArchiveGame(games, fullPath, coversFolder, setupPathArchive)
    }

    if (isRoot && playFiles.length === 1) {
      const fullPath = join(currentDirectory, playFiles[0])
      const setupPath = detectSetupInDirectory(currentDirectory)
      pushLooseExecutable(games, fullPath, coversFolder, setupPath)
    } else if (isRoot && playFiles.length > 1) {
      skippedRootLooseExes += playFiles.length
      logger.warn(
        'Multiple loose EXEs in the library root were skipped. Put each game in its own folder.',
        { count: playFiles.length, sample: playFiles.slice(0, 8) }
      )
    }

    for (const sub of subdirs) {
      await visit(join(currentDirectory, sub), false)
    }
  }

  await visit(rootDirectory, true)

  if (folderGames > 0) {
    logger.info('Folder games detected', { folderGames })
  }
  if (skippedExtras > 0) {
    logger.info('Skipped utility/help/catalog executables', { skippedExtras })
  }
  if (skippedRootLooseExes > 0) {
    logger.info('Skipped loose root EXEs (use folders)', { skippedRootLooseExes })
  }

  const withSetup = games.filter((game) => game.hasSetup).length
  if (withSetup > 0) {
    logger.info('Games with setup/config detected', { withSetup, total: games.length })
  }

  games.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }))
  return games
}

export async function scanGames(gamesFolder: string, coversFolder: string): Promise<ScanResult> {
  if (!gamesFolder?.trim()) {
    return { games: [], error: 'No hay una carpeta de juegos configurada.' }
  }

  const rootDirectory = resolve(gamesFolder)
  if (!existsSync(rootDirectory)) {
    return { games: [], error: `La carpeta no existe: ${rootDirectory}` }
  }

  try {
    const stats = statSync(rootDirectory)
    if (!stats.isDirectory()) {
      return { games: [], error: 'La ruta de juegos no es una carpeta.' }
    }
    const resolvedCoversFolder = coversFolder?.trim() ? resolve(coversFolder) : ''
    const games = await collectGames(rootDirectory, resolvedCoversFolder)
    return { games }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Scan failed', { gamesFolder: rootDirectory, message })
    return { games: [], error: `No se pudo escanear la carpeta: ${message}` }
  }
}

export { isPathInside } from './paths'
