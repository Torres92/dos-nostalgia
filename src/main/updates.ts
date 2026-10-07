import { app } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult } from '../shared/updates'
import { detectDistributionChannel } from './channel'
import { logger } from './logger'

let configured = false

function configureUpdater(): void {
  if (configured) return
  configured = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
}

function readHomepage(): string {
  try {
    const pkgPath = join(app.getAppPath(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { homepage?: string }
    return pkg.homepage?.trim() ?? ''
  } catch {
    return ''
  }
}

function githubRepoBaseUrl(): string | undefined {
  const url = readHomepage()
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/i.test(url)) return undefined
  if (/^https:\/\/github\.com\/?$/i.test(url)) return undefined
  return url.replace(/\/issues\/?$/i, '').replace(/\/$/, '')
}

/** GitHub releases page when homepage is a real repo URL (not the placeholder). */
export function releasePageUrl(): string | undefined {
  const base = githubRepoBaseUrl()
  return base ? `${base}/releases` : undefined
}

/** GitHub new-issue page when homepage is a real repo URL. */
export function supportIssuesNewUrl(): string | undefined {
  const base = githubRepoBaseUrl()
  return base ? `${base}/issues/new` : undefined
}

/**
 * Check for a newer build. Steam → no-op. Dev → skipped.
 * Direct packaged → electron-updater (needs publish/GitHub Releases).
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const channel = detectDistributionChannel()
  const currentVersion = app.getVersion()

  if (channel === 'steam') {
    return {
      status: 'steam-managed',
      channel,
      currentVersion,
      message: 'Las actualizaciones las maneja Steam.'
    }
  }

  if (!app.isPackaged) {
    return {
      status: 'skipped-dev',
      channel,
      currentVersion,
      message: 'Check de updates solo en builds empaquetados.'
    }
  }

  configureUpdater()

  try {
    const result = await autoUpdater.checkForUpdates()
    const latest = result?.updateInfo?.version
    if (!result?.updateInfo || !latest || latest === currentVersion) {
      return {
        status: 'up-to-date',
        channel,
        currentVersion,
        latestVersion: latest,
        message: 'Estás en la última versión.'
      }
    }

    logger.info('Update available', { currentVersion, latestVersion: latest })
    return {
      status: 'available',
      channel,
      currentVersion,
      latestVersion: latest,
      releaseUrl: releasePageUrl(),
      message: `Hay una actualización: ${latest}`
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('Update check failed (missing publish/repo is OK for now)', { message })
    return {
      status: 'unavailable',
      channel,
      currentVersion,
      releaseUrl: releasePageUrl(),
      message:
        'Feed de updates aún no configurado (repo/releases). El check quedará activo cuando exista publish.'
    }
  }
}

export async function downloadAndInstallUpdate(): Promise<{ ok: boolean; message: string }> {
  if (detectDistributionChannel() === 'steam') {
    return { ok: false, message: 'En Steam las actualizaciones las aplica el cliente Steam.' }
  }
  if (!app.isPackaged) {
    return { ok: false, message: 'Solo disponible en builds empaquetados.' }
  }

  configureUpdater()
  try {
    await autoUpdater.checkForUpdates()
    await autoUpdater.downloadUpdate()
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true)
    })
    return { ok: true, message: 'Descargando e instalando…' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Update download/install failed', { message })
    return { ok: false, message }
  }
}
