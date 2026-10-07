import { BrowserWindow, Menu, shell, nativeImage, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import iconPng from '../../resources/icon.png?asset'
import { IpcChannels } from '../shared/ipc-channels'
import { ALLOWED_EXTERNAL_URLS } from '../shared/credits'
import { logger } from './logger'

function broadcastFullscreen(mainWindow: BrowserWindow): void {
  mainWindow.webContents.send(IpcChannels.windowFullscreenChanged, mainWindow.isFullScreen())
}

function isAllowedExternalUrl(url: string): boolean {
  if (!/^https:\/\//i.test(url)) return false
  return (ALLOWED_EXTERNAL_URLS as readonly string[]).includes(url)
}

/** Windows titlebar prefers .ico; fall back to PNG brand mark. */
function resolveWindowIcon(): Electron.NativeImage | string {
  const candidates = [
    join(app.getAppPath(), 'resources', 'icon.ico'),
    join(__dirname, '../../resources/icon.ico'),
    join(process.resourcesPath, 'icon.ico')
  ]
  if (process.platform === 'win32') {
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        const image = nativeImage.createFromPath(candidate)
        if (!image.isEmpty()) return image
      }
    }
  }
  return iconPng
}

export function createMainWindow(): BrowserWindow {
  // Without this, Windows/Electron steals F10 for the menu bar.
  // Raptor SETUP (and many DOS tools) use F10 = Accept / save config.
  Menu.setApplicationMenu(null)

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'DOS Nostalgia',
    backgroundColor: '#a8a8a8',
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    logger.info('Main window shown')
  })

  mainWindow.on('enter-full-screen', () => broadcastFullscreen(mainWindow))
  mainWindow.on('leave-full-screen', () => broadcastFullscreen(mainWindow))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      void shell.openExternal(details.url)
    } else {
      logger.warn('Blocked window.open / openExternal', { url: details.url })
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    const allowed =
      url.startsWith('file:') ||
      (is.dev && typeof rendererUrl === 'string' && url.startsWith(rendererUrl))
    if (!allowed) {
      event.preventDefault()
      logger.warn('Blocked in-app navigation', { url })
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
