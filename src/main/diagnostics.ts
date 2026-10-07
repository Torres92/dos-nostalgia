import { app, clipboard, shell } from 'electron'
import { existsSync } from 'fs'
import type { DiagnosticReport, GameEntry, LastLaunchInfo } from '../shared/types'
import { loadSettings } from './settings'
import {
  buildAppInfo,
  getLogsPath,
  getRecentErrors,
  getRecentLogs,
  logger,
  writeDiagnosticsFile
} from './logger'
import { supportIssuesNewUrl } from './updates'

export interface SupportSubmitInput {
  errorSummary: string
  userComment?: string
  contextLabel?: string
}

export interface SupportSubmitResult {
  reportPath: string
  copied: boolean
  openedIssueUrl: string | null
  mode: 'github-issues' | 'clipboard-only'
  message: string
}

let lastLaunch: LastLaunchInfo | null = null

export function recordLastLaunch(
  game: GameEntry,
  extras?: { entryCommand?: string; ega?: boolean }
): void {
  lastLaunch = {
    title: game.title,
    filename: game.filename,
    path: game.path,
    kind: game.kind,
    at: new Date().toISOString(),
    ...(extras?.entryCommand ? { entryCommand: extras.entryCommand } : {}),
    ...(typeof extras?.ega === 'boolean' ? { ega: extras.ega } : {})
  }
  logger.info('Launch recorded', {
    title: lastLaunch.title,
    path: lastLaunch.path,
    kind: lastLaunch.kind,
    entryCommand: lastLaunch.entryCommand,
    ega: lastLaunch.ega
  })
}

export function buildDiagnosticReport(): DiagnosticReport {
  const settings = loadSettings()
  return {
    generatedAt: new Date().toISOString(),
    app: buildAppInfo(),
    settings: {
      gamesFolder: settings.gamesFolder,
      coversFolder: settings.coversFolder,
      legalAcceptedAt: settings.legalAcceptedAt,
      gamesFolderExists: Boolean(settings.gamesFolder) && existsSync(settings.gamesFolder),
      coversFolderExists: Boolean(settings.coversFolder) && existsSync(settings.coversFolder)
    },
    lastLaunch,
    recentErrors: getRecentErrors(30),
    recentLogs: getRecentLogs(80)
  }
}

export function openLogsFolder(): string {
  const logsPath = getLogsPath()
  void shell.openPath(logsPath)
  logger.info('Opened logs folder', { logsPath })
  return logsPath
}

export function copyDiagnosticsReport(): { reportPath: string; copied: boolean } {
  const report = buildDiagnosticReport()
  const reportJson = JSON.stringify(report, null, 2)
  const reportPath = writeDiagnosticsFile(reportJson)
  clipboard.writeText(reportJson)
  logger.info('Diagnostics report copied', {
    reportPath,
    appVersion: app.getVersion(),
    lastLaunch: lastLaunch?.title ?? null
  })
  return { reportPath, copied: true }
}

/**
 * User-facing support flow: copy a paste-ready report, then open GitHub Issues
 * when homepage points to a real repo. Until then → clipboard only.
 */
export async function submitSupportReport(input: SupportSubmitInput): Promise<SupportSubmitResult> {
  const errorSummary = input.errorSummary.trim() || 'Sin detalle de error'
  const userComment = input.userComment?.trim() || ''
  const contextLabel = input.contextLabel?.trim() || 'Soporte'
  const report = buildDiagnosticReport()
  const reportJson = JSON.stringify(report, null, 2)

  const clipboardText = [
    `# DOS Nostalgia — reporte de soporte`,
    ``,
    `## Contexto`,
    contextLabel,
    ``,
    `## Error`,
    errorSummary,
    ``,
    `## Comentario del usuario`,
    userComment || '(sin comentario)',
    ``,
    `## App`,
    `v${report.app.version} · ${report.app.platform}/${report.app.arch} · canal ${report.app.distributionChannel}`,
    ``,
    `## Diagnóstico (JSON)`,
    '```json',
    reportJson,
    '```',
    ``
  ].join('\n')

  const reportPath = writeDiagnosticsFile(clipboardText)
  clipboard.writeText(clipboardText)

  const issuesBase = supportIssuesNewUrl()
  if (!issuesBase) {
    logger.info('Support submit: clipboard only (no GitHub homepage)', {
      reportPath,
      contextLabel
    })
    return {
      reportPath,
      copied: true,
      openedIssueUrl: null,
      mode: 'clipboard-only',
      message:
        'Reporte copiado al portapapeles. Cuando exista el repo de GitHub, Enviar abrirá Issues automáticamente.'
    }
  }

  const title = `[${contextLabel}] ${errorSummary}`.slice(0, 120)
  const issueBody = [
    `## Qué pasó`,
    userComment || '_(sin comentario)_',
    ``,
    `## Error`,
    '```',
    errorSummary,
    '```',
    ``,
    `## App`,
    `- Versión: ${report.app.version}`,
    `- SO: ${report.app.platform}/${report.app.arch}`,
    `- Canal: ${report.app.distributionChannel}`,
    ...(lastLaunch ? [`- Último juego: ${lastLaunch.title} (${lastLaunch.kind})`] : []),
    ``,
    `## Diagnóstico`,
    `El reporte completo ya está en el portapapeles — **pegá Ctrl+V debajo**.`,
    ``,
    `<!-- Pegá el reporte aquí -->`,
    ``
  ].join('\n')

  const openedIssueUrl = `${issuesBase}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(issueBody)}`
  await shell.openExternal(openedIssueUrl)
  logger.info('Support submit: opened GitHub issue form', {
    reportPath,
    contextLabel,
    openedIssueUrl: issuesBase
  })

  return {
    reportPath,
    copied: true,
    openedIssueUrl,
    mode: 'github-issues',
    message: 'Se abrió GitHub Issues. Pegá el reporte (Ctrl+V) en el issue y publicá.'
  }
}
