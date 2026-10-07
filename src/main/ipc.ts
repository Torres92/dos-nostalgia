import { BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { existsSync } from 'fs'
import { isAbsolute, resolve } from 'path'
import { IpcChannels } from '../shared/ipc-channels'
import { ALLOWED_EXTERNAL_URLS } from '../shared/credits'
import type { AppSettings, GameEntry, LaunchMode, LogLevel } from '../shared/types'
import { loadSettings, saveSettings } from './settings'
import { scanGames } from './scan-games'
import { buildGameBundle } from './build-bundle'
import { applyPersistedChangesToDirectory, writeFilesToDirectory } from './apply-persisted'
import { listFolderExecutables } from './list-folder'
import { isPathInside } from './paths'
import { buildAppInfo, logger, writeLog } from './logger'
import {
  buildDiagnosticReport,
  copyDiagnosticsReport,
  openLogsFolder,
  recordLastLaunch,
  submitSupportReport,
  type SupportSubmitInput
} from './diagnostics'
import { getLicensesDirectory, licensesDirectoryExists } from './licenses-path'
import { checkForAppUpdate, downloadAndInstallUpdate, releasePageUrl } from './updates'

function assertLibraryFolder(label: string, folder: string): string {
  const trimmed = folder.trim()
  if (!trimmed) return ''
  if (!isAbsolute(trimmed)) {
    throw new Error(`${label} debe ser una ruta absoluta.`)
  }
  return resolve(trimmed)
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.settingsGet, () => loadSettings())

  ipcMain.handle(IpcChannels.settingsSet, (_event, settings: AppSettings) => {
    const next: AppSettings = {
      gamesFolder: assertLibraryFolder('La carpeta de juegos', settings.gamesFolder ?? ''),
      coversFolder: assertLibraryFolder('La carpeta de portadas', settings.coversFolder ?? ''),
      legalAcceptedAt: settings.legalAcceptedAt
    }
    const saved = saveSettings(next)
    logger.info('Settings saved', {
      gamesFolder: saved.gamesFolder,
      coversFolder: saved.coversFolder
    })
    return saved
  })

  ipcMain.handle(IpcChannels.dialogPickFolder, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Seleccionar carpeta'
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.gamesScan, async () => {
    const settings = loadSettings()
    logger.info('Scanning games folder', {
      gamesFolder: settings.gamesFolder,
      coversFolder: settings.coversFolder
    })
    const result = await scanGames(settings.gamesFolder, settings.coversFolder)
    if (result.error) {
      logger.warn('Scan finished with error', {
        error: result.error,
        gameCount: result.games.length
      })
    } else {
      logger.info('Scan finished', { gameCount: result.games.length })
    }
    return result
  })

  ipcMain.handle(
    IpcChannels.gamesBuildBundle,
    async (
      _event,
      game: GameEntry,
      mode: LaunchMode = 'play',
      entryFile?: string | null
    ) => {
      const settings = loadSettings()
      const allowedRoots = [settings.gamesFolder, settings.coversFolder].filter(Boolean)
      const pathAllowed = allowedRoots.some((root) => isPathInside(root, game.path))
      if (!pathAllowed) {
        logger.error('Bundle rejected: path outside allowed folders', {
          path: game.path,
          allowedRoots
        })
        throw new Error('El juego está fuera de las carpetas permitidas.')
      }
      // Renderer-supplied directory must also stay inside the library (confused-deputy guard).
      if (game.directory) {
        const directoryAllowed = allowedRoots.some((root) => isPathInside(root, game.directory))
        if (!directoryAllowed) {
          logger.error('Bundle rejected: directory outside allowed folders', {
            directory: game.directory,
            path: game.path,
            allowedRoots
          })
          throw new Error('La carpeta del juego está fuera de las carpetas permitidas.')
        }
        const sameRoot = resolve(game.path) === resolve(game.directory)
        if (!sameRoot && !isPathInside(game.directory, game.path)) {
          logger.error('Bundle rejected: path not inside game.directory', {
            path: game.path,
            directory: game.directory
          })
          throw new Error('Ruta de juego inconsistente.')
        }
      }
      if (!existsSync(game.path) && game.kind !== 'folder') {
        logger.error('Bundle rejected: file missing', { path: game.path })
        throw new Error('No se encuentra el archivo del juego.')
      }
      if (game.kind === 'folder' && !existsSync(game.directory)) {
        throw new Error('No se encuentra la carpeta del juego.')
      }

      const launchMode: LaunchMode = mode === 'setup' ? 'setup' : 'play'
      const override =
        typeof entryFile === 'string' && entryFile.trim() ? entryFile.trim() : null

      logger.info('Building game bundle', {
        title: game.title,
        path: game.path,
        kind: game.kind,
        filename: game.filename,
        mode: launchMode,
        entryFile: override
      })

      try {
        const bundle = await buildGameBundle(game, launchMode, override)
        recordLastLaunch(game, {
          entryCommand: bundle.entryCommand,
          ega: bundle.ega
        })
        logger.info('Bundle built', {
          title: game.title,
          mode: launchMode,
          entryFile: override,
          byteLength: bundle.bytes.byteLength,
          entryCommand: bundle.entryCommand,
          ega: bundle.ega
        })
        return bundle.bytes.buffer.slice(
          bundle.bytes.byteOffset,
          bundle.bytes.byteOffset + bundle.bytes.byteLength
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        logger.error('Bundle build failed', {
          title: game.title,
          path: game.path,
          mode: launchMode,
          entryFile: override,
          message,
          stack
        })
        throw err
      }
    }
  )

  ipcMain.handle(IpcChannels.gamesListFolder, (_event, directory: string) => {
    const settings = loadSettings()
    if (!directory || typeof directory !== 'string') {
      throw new Error('Carpeta inválida.')
    }
    const allowed = Boolean(settings.gamesFolder) && isPathInside(settings.gamesFolder, directory)
    if (!allowed) {
      logger.warn('list-folder rejected: outside games folder', { directory })
      throw new Error('La carpeta está fuera de la biblioteca configurada.')
    }
    logger.info('Listing folder executables', { directory })
    return listFolderExecutables(directory)
  })

  ipcMain.handle(
    IpcChannels.gamesApplyPersisted,
    async (
      _event,
      payload: { directory: string; zipBytes: ArrayBuffer }
    ): Promise<{ written: number; files: string[] }> => {
      const settings = loadSettings()
      const directory = payload?.directory
      if (!directory || typeof directory !== 'string') {
        throw new Error('Carpeta de juego inválida.')
      }
      const allowedRoots = [settings.gamesFolder].filter(Boolean)
      const isAllowed = allowedRoots.some((root) => isPathInside(root, directory))
      if (!isAllowed) {
        throw new Error('La carpeta está fuera de la biblioteca configurada.')
      }
      const bytes = new Uint8Array(payload.zipBytes)
      return applyPersistedChangesToDirectory(directory, bytes)
    }
  )

  ipcMain.handle(
    IpcChannels.gamesWriteFiles,
    (
      _event,
      payload: {
        directory: string
        files: Array<{ relativePath: string; data: ArrayBuffer }>
      }
    ): { written: number; files: string[] } => {
      const settings = loadSettings()
      const directory = payload?.directory
      if (!directory || typeof directory !== 'string') {
        throw new Error('Carpeta de juego inválida.')
      }
      const allowedRoots = [settings.gamesFolder].filter(Boolean)
      const isAllowed = allowedRoots.some((root) => isPathInside(root, directory))
      if (!isAllowed) {
        throw new Error('La carpeta está fuera de la biblioteca configurada.')
      }
      const files = (payload.files ?? []).map((file) => ({
        relativePath: file.relativePath,
        data: new Uint8Array(file.data)
      }))
      return writeFilesToDirectory(directory, files)
    }
  )

  ipcMain.handle(IpcChannels.appGetInfo, () => buildAppInfo())

  ipcMain.handle(
    IpcChannels.logWrite,
    (
      _event,
      payload: { level: LogLevel; message: string; context?: Record<string, unknown> }
    ) => {
      const level = payload?.level ?? 'info'
      const message = payload?.message ?? ''
      writeLog(level, `[renderer] ${message}`, payload?.context)
      return true
    }
  )

  ipcMain.handle(IpcChannels.diagnosticsGet, () => buildDiagnosticReport())

  ipcMain.handle(IpcChannels.diagnosticsOpenLogs, () => openLogsFolder())

  ipcMain.handle(IpcChannels.diagnosticsCopyReport, () => copyDiagnosticsReport())

  ipcMain.handle(IpcChannels.diagnosticsSubmitSupport, (_event, input: SupportSubmitInput) =>
    submitSupportReport(input ?? { errorSummary: '' })
  )

  ipcMain.handle(IpcChannels.licensesOpenFolder, () => {
    const licensesPath = getLicensesDirectory()
    if (!licensesDirectoryExists()) {
      logger.error('Licenses folder missing', { licensesPath })
      throw new Error(`No se encuentra la carpeta de licencias: ${licensesPath}`)
    }
    void shell.openPath(licensesPath)
    logger.info('Opened licenses folder', { licensesPath })
    return licensesPath
  })

  ipcMain.handle(IpcChannels.shellOpenExternal, async (_event, url: string) => {
    const allowed = (ALLOWED_EXTERNAL_URLS as readonly string[]).includes(url)
    if (!allowed || !/^https:\/\//i.test(url)) {
      logger.warn('Blocked openExternal', { url })
      throw new Error('URL no permitida.')
    }
    await shell.openExternal(url)
    logger.info('Opened external URL', { url })
    return true
  })

  ipcMain.handle(IpcChannels.updatesCheck, () => checkForAppUpdate())

  ipcMain.handle(IpcChannels.updatesDownloadInstall, () => downloadAndInstallUpdate())

  ipcMain.handle(IpcChannels.updatesOpenRelease, async () => {
    const url = releasePageUrl()
    if (!url) {
      throw new Error(
        'Todavía no hay URL de releases (configurá homepage del repo en package.json).'
      )
    }
    await shell.openExternal(url)
    logger.info('Opened releases page', { url })
    return url
  })

  const windowFromEvent = (event: Electron.IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(event.sender)

  ipcMain.handle(IpcChannels.windowToggleFullscreen, (event) => {
    const win = windowFromEvent(event)
    if (!win) return false
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    return next
  })

  ipcMain.handle(IpcChannels.windowSetFullscreen, (event, fullscreen: boolean) => {
    const win = windowFromEvent(event)
    if (!win) return false
    win.setFullScreen(Boolean(fullscreen))
    return win.isFullScreen()
  })

  ipcMain.handle(IpcChannels.windowIsFullscreen, (event) => {
    const win = windowFromEvent(event)
    return win?.isFullScreen() ?? false
  })

  logger.info('IPC handlers registered')
}
