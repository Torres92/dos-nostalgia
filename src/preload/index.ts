import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import type {
  AppInfo,
  AppSettings,
  DiagnosticReport,
  FolderFileEntry,
  GameEntry,
  LaunchMode,
  LogLevel,
  ScanResult,
  UpdateCheckResult
} from '../shared/types'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IpcChannels.settingsGet),
  setSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.settingsSet, settings),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.dialogPickFolder),
  scanGames: (): Promise<ScanResult> => ipcRenderer.invoke(IpcChannels.gamesScan),
  buildBundle: (
    game: GameEntry,
    mode: LaunchMode = 'play',
    entryFile?: string | null
  ): Promise<ArrayBuffer> =>
    ipcRenderer.invoke(IpcChannels.gamesBuildBundle, game, mode, entryFile ?? null),
  listFolder: (directory: string): Promise<FolderFileEntry[]> =>
    ipcRenderer.invoke(IpcChannels.gamesListFolder, directory),
  applyPersistedChanges: (
    directory: string,
    zipBytes: ArrayBuffer
  ): Promise<{ written: number; files: string[] }> =>
    ipcRenderer.invoke(IpcChannels.gamesApplyPersisted, { directory, zipBytes }),
  writeGameFiles: (
    directory: string,
    files: Array<{ relativePath: string; data: ArrayBuffer }>
  ): Promise<{ written: number; files: string[] }> =>
    ipcRenderer.invoke(IpcChannels.gamesWriteFiles, { directory, files }),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IpcChannels.appGetInfo),
  log: (level: LogLevel, message: string, context?: Record<string, unknown>): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.logWrite, { level, message, context }),
  getDiagnostics: (): Promise<DiagnosticReport> =>
    ipcRenderer.invoke(IpcChannels.diagnosticsGet),
  openLogsFolder: (): Promise<string> => ipcRenderer.invoke(IpcChannels.diagnosticsOpenLogs),
  copyDiagnosticsReport: (): Promise<{ reportPath: string; copied: boolean }> =>
    ipcRenderer.invoke(IpcChannels.diagnosticsCopyReport),
  submitSupportReport: (input: {
    errorSummary: string
    userComment?: string
    contextLabel?: string
  }): Promise<{
    reportPath: string
    copied: boolean
    openedIssueUrl: string | null
    mode: 'github-issues' | 'clipboard-only'
    message: string
  }> => ipcRenderer.invoke(IpcChannels.diagnosticsSubmitSupport, input),
  openLicensesFolder: (): Promise<string> => ipcRenderer.invoke(IpcChannels.licensesOpenFolder),
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.shellOpenExternal, url),
  checkForUpdates: (): Promise<UpdateCheckResult> =>
    ipcRenderer.invoke(IpcChannels.updatesCheck),
  downloadAndInstallUpdate: (): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke(IpcChannels.updatesDownloadInstall),
  openReleasesPage: (): Promise<string> => ipcRenderer.invoke(IpcChannels.updatesOpenRelease),
  toggleFullscreen: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.windowToggleFullscreen),
  setFullscreen: (fullscreen: boolean): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.windowSetFullscreen, fullscreen),
  isFullscreen: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.windowIsFullscreen),
  onFullscreenChanged: (callback: (fullscreen: boolean) => void): (() => void) => {
    const listener = (_event: unknown, nextFullscreen: boolean): void => {
      callback(nextFullscreen)
    }
    ipcRenderer.on(IpcChannels.windowFullscreenChanged, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.windowFullscreenChanged, listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback when isolation is off
  window.api = api
}
