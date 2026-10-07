import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Folder with GPL text + third-party notices.
 * Dev: <repo>/licenses
 * Packaged: <resources>/licenses (electron-builder extraResources)
 */
export function getLicensesDirectory(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'licenses')
  }
  // electron-vite: __dirname is out/main → repo root is ../..
  return join(__dirname, '../../licenses')
}

export function licensesDirectoryExists(): boolean {
  return existsSync(getLicensesDirectory())
}
