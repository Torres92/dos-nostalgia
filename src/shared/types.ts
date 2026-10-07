import type { DistributionChannel } from './updates'

export type {
  DistributionChannel,
  UpdateCheckResult,
  UpdateCheckStatus
} from './updates'

export interface AppSettings {
  gamesFolder: string
  coversFolder: string
  /** ISO timestamp when the user accepted TERMS/PRIVACY on first run; null if pending. */
  legalAcceptedAt: string | null
}

export type LaunchMode = 'play' | 'setup'

export type FolderFileRole = 'play' | 'setup' | 'other'

/** Executable listed when browsing inside a folder game. */
export interface FolderFileEntry {
  id: string
  name: string
  path: string
  role: FolderFileRole
}

export interface GameEntry {
  id: string
  title: string
  filename: string
  path: string
  /** folder = one unpacked game directory shown as a single library row */
  kind: 'executable' | 'folder' | 'zip' | 'rar'
  coverPath: string | null
  coverUrl: string | null
  directory: string
  /** True when a SETUP/CONFIG/SETSOUND-style tool was found next to the game. */
  hasSetup: boolean
  /**
   * Relative path (zip-style `/`) of the setup executable inside the bundle/folder,
   * e.g. `SETUP.EXE` or `RAPTOR/SETUP.EXE`. Null when hasSetup is false.
   */
  setupPath: string | null
}

export interface ScanResult {
  games: GameEntry[]
  error?: string
}

export type LogLevel = 'info' | 'warn' | 'error'

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  osRelease: string
  isPackaged: boolean
  userDataPath: string
  logsPath: string
  licensesPath: string
  /** steam = Steam owns updates; direct = electron-updater / installer. */
  distributionChannel: DistributionChannel
}

export interface DiagnosticLogEntry {
  ts: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
}

export interface LastLaunchInfo {
  title: string
  filename: string
  path: string
  kind: GameEntry['kind']
  at: string
  entryCommand?: string
  ega?: boolean
}

export interface DiagnosticReport {
  generatedAt: string
  app: AppInfo
  settings: {
    gamesFolder: string
    coversFolder: string
    legalAcceptedAt: string | null
    gamesFolderExists: boolean
    coversFolderExists: boolean
  }
  lastLaunch: LastLaunchInfo | null
  recentErrors: DiagnosticLogEntry[]
  recentLogs: DiagnosticLogEntry[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  gamesFolder: '',
  coversFolder: '',
  legalAcceptedAt: null
}

export const GAME_EXTENSIONS = ['.exe', '.com', '.bat', '.zip', '.rar'] as const
