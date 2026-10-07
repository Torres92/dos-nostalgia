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

export interface LauncherApi {
  getSettings: () => Promise<AppSettings>
  setSettings: (settings: AppSettings) => Promise<AppSettings>
  pickFolder: () => Promise<string | null>
  scanGames: () => Promise<ScanResult>
  buildBundle: (
    game: GameEntry,
    mode?: LaunchMode,
    entryFile?: string | null
  ) => Promise<ArrayBuffer>
  listFolder: (directory: string) => Promise<FolderFileEntry[]>
  applyPersistedChanges: (
    directory: string,
    zipBytes: ArrayBuffer
  ) => Promise<{ written: number; files: string[] }>
  writeGameFiles: (
    directory: string,
    files: Array<{ relativePath: string; data: ArrayBuffer }>
  ) => Promise<{ written: number; files: string[] }>
  getAppInfo: () => Promise<AppInfo>
  log: (level: LogLevel, message: string, context?: Record<string, unknown>) => Promise<boolean>
  getDiagnostics: () => Promise<DiagnosticReport>
  openLogsFolder: () => Promise<string>
  copyDiagnosticsReport: () => Promise<{ reportPath: string; copied: boolean }>
  submitSupportReport: (input: {
    errorSummary: string
    userComment?: string
    contextLabel?: string
  }) => Promise<{
    reportPath: string
    copied: boolean
    openedIssueUrl: string | null
    mode: 'github-issues' | 'clipboard-only'
    message: string
  }>
  openLicensesFolder: () => Promise<string>
  openExternal: (url: string) => Promise<boolean>
  checkForUpdates: () => Promise<UpdateCheckResult>
  downloadAndInstallUpdate: () => Promise<{ ok: boolean; message: string }>
  openReleasesPage: () => Promise<string>
  toggleFullscreen: () => Promise<boolean>
  setFullscreen: (fullscreen: boolean) => Promise<boolean>
  isFullscreen: () => Promise<boolean>
  onFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void
}

declare global {
  interface Window {
    api: LauncherApi
  }
}

export {}
