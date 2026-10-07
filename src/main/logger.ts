import { app } from 'electron'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { release } from 'os'
import type { AppInfo, DiagnosticLogEntry, LogLevel } from '../shared/types'
import { getLicensesDirectory } from './licenses-path'
import { detectDistributionChannel } from './channel'

const LOG_RETENTION_DAYS = 7
const MEMORY_RING_SIZE = 200

let logsDirectoryPath: string | null = null
const memoryRing: DiagnosticLogEntry[] = []

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function ensureLogsDirectory(): string {
  if (logsDirectoryPath) return logsDirectoryPath
  const directory = join(app.getPath('userData'), 'logs')
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true })
  }
  logsDirectoryPath = directory
  return directory
}

function logFilePathForToday(): string {
  return join(ensureLogsDirectory(), `app-${todayStamp()}.log`)
}

function pruneOldLogs(): void {
  const directory = ensureLogsDirectory()
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  try {
    for (const name of readdirSync(directory)) {
      if (!/^app-\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue
      const fullPath = join(directory, name)
      const day = name.slice(4, 14)
      const fileTime = Date.parse(`${day}T00:00:00.000Z`)
      if (!Number.isNaN(fileTime) && fileTime < cutoff) {
        try {
          unlinkSync(fullPath)
        } catch {
          // ignore prune failures
        }
      }
    }
  } catch {
    // ignore listing failures
  }
}

function pushMemory(entry: DiagnosticLogEntry): void {
  memoryRing.push(entry)
  if (memoryRing.length > MEMORY_RING_SIZE) {
    memoryRing.splice(0, memoryRing.length - MEMORY_RING_SIZE)
  }
}

function formatLine(entry: DiagnosticLogEntry): string {
  const contextJson = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  return `${entry.ts} [${entry.level.toUpperCase()}] ${entry.message}${contextJson}\n`
}

export function getLogsPath(): string {
  return ensureLogsDirectory()
}

export function getRecentLogs(limit = 80): DiagnosticLogEntry[] {
  return memoryRing.slice(-limit)
}

export function getRecentErrors(limit = 30): DiagnosticLogEntry[] {
  return memoryRing.filter((entry) => entry.level === 'error').slice(-limit)
}

export function writeLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: DiagnosticLogEntry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {})
  }
  pushMemory(entry)

  const line = formatLine(entry)
  if (level === 'error') {
    console.error(line.trimEnd())
  } else if (level === 'warn') {
    console.warn(line.trimEnd())
  } else {
    console.log(line.trimEnd())
  }

  try {
    appendFileSync(logFilePathForToday(), line, 'utf-8')
  } catch (err) {
    console.error('[logger] failed to write log file', err)
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>): void =>
    writeLog('info', message, context),
  warn: (message: string, context?: Record<string, unknown>): void =>
    writeLog('warn', message, context),
  error: (message: string, context?: Record<string, unknown>): void =>
    writeLog('error', message, context)
}

export function buildAppInfo(): AppInfo {
  return {
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    osRelease: release(),
    isPackaged: app.isPackaged,
    userDataPath: app.getPath('userData'),
    logsPath: getLogsPath(),
    licensesPath: getLicensesDirectory(),
    distributionChannel: detectDistributionChannel()
  }
}

export function initLogger(): void {
  ensureLogsDirectory()
  pruneOldLogs()
  logger.info('Logger ready', {
    logsPath: getLogsPath(),
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged
  })

  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', {
      name: err.name,
      message: err.message,
      stack: err.stack
    })
  })

  process.on('unhandledRejection', (reason) => {
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : JSON.stringify(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    logger.error('unhandledRejection', { message, stack })
  })
}

export function writeDiagnosticsFile(reportJson: string): string {
  const targetPath = join(ensureLogsDirectory(), 'diagnostics-report.json')
  writeFileSync(targetPath, reportJson, 'utf-8')
  return targetPath
}
