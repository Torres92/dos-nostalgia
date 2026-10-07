import { app, protocol, net, BrowserWindow, session } from 'electron'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { existsSync } from 'fs'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { loadSettings } from './settings'
import { isPathInside } from './paths'
import { initLogger, logger } from './logger'
import { registerIpcHandlers } from './ipc'
import { createMainWindow } from './window'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'localmedia',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function registerLocalMediaProtocol(): void {
  protocol.handle('localmedia', (request) => {
    try {
      const parsed = new URL(request.url)
      const filePath = resolve(decodeURIComponent(parsed.searchParams.get('path') ?? ''))
      if (!filePath) {
        return new Response('Bad request', { status: 400 })
      }
      const settings = loadSettings()
      const roots = [settings.gamesFolder, settings.coversFolder].filter(Boolean)
      const allowed = roots.some((root) => isPathInside(root, filePath))
      if (!allowed || !existsSync(filePath)) {
        return new Response('Not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(filePath).href)
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })
}

/** Allow Pointer Lock so DOS games with relative mouse (Raptor, Doom) get movement. */
function allowPointerLock(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'pointerLock' || permission === 'fullscreen') {
      callback(true)
      return
    }
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'pointerLock' || permission === 'fullscreen' || permission === 'clipboard-read'
  })
}

app.whenReady().then(() => {
  initLogger()
  electronApp.setAppUserModelId('com.dosnostalgia.launcher')
  allowPointerLock()
  registerLocalMediaProtocol()

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createMainWindow()
  logger.info('App ready')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    logger.info('All windows closed — quitting')
    app.quit()
  }
})
