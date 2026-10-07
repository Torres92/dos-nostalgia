import { readdirSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import type { FolderFileEntry } from '../shared/types'
import { isExecutableName, isPrimaryPlayExecutable, isSetupExecutable } from './pick-entry'
import { isPathInside } from './paths'
import { loadSettings } from './settings'

function roleForName(name: string): FolderFileEntry['role'] {
  if (isSetupExecutable(name)) return 'setup'
  if (isPrimaryPlayExecutable(name)) return 'play'
  return 'other'
}

/**
 * List .exe/.com/.bat inside a game folder for the DIR browser.
 * Only allowed under the configured games folder.
 */
export function listFolderExecutables(directory: string): FolderFileEntry[] {
  const settings = loadSettings()
  const root = settings.gamesFolder?.trim()
  if (!root) {
    throw new Error('No hay una carpeta de juegos configurada.')
  }

  const target = resolve(directory)
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    throw new Error(`La carpeta no existe: ${target}`)
  }
  if (!isPathInside(resolve(root), target)) {
    throw new Error('La carpeta está fuera de la biblioteca configurada.')
  }

  let names: string[]
  try {
    names = readdirSync(target)
  } catch {
    throw new Error(`No se pudo leer la carpeta: ${target}`)
  }

  const files: FolderFileEntry[] = []
  for (const name of names) {
    if (name.startsWith('.')) continue
    if (!isExecutableName(name)) continue
    const fullPath = join(target, name)
    try {
      if (!statSync(fullPath).isFile()) continue
    } catch {
      continue
    }
    files.push({
      id: fullPath,
      name,
      path: fullPath,
      role: roleForName(name)
    })
  }

  const roleOrder = { play: 0, setup: 1, other: 2 }
  files.sort(
    (a, b) =>
      roleOrder[a.role] - roleOrder[b.role] ||
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  )
  return files
}
