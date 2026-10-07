import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

const SETTINGS_FILE = 'settings.json'

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

export function loadSettings(): AppSettings {
  try {
    const path = settingsPath()
    if (!existsSync(path)) {
      return { ...DEFAULT_SETTINGS }
    }
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<AppSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      legalAcceptedAt:
        typeof raw.legalAcceptedAt === 'string' && raw.legalAcceptedAt.trim()
          ? raw.legalAcceptedAt
          : null
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const next: AppSettings = {
    gamesFolder: settings.gamesFolder?.trim() ?? '',
    coversFolder: settings.coversFolder?.trim() ?? '',
    legalAcceptedAt:
      typeof settings.legalAcceptedAt === 'string' && settings.legalAcceptedAt.trim()
        ? settings.legalAcceptedAt.trim()
        : null
  }
  const target = settingsPath()
  const temp = `${target}.tmp`
  writeFileSync(temp, JSON.stringify(next, null, 2), 'utf-8')
  renameSync(temp, target)
  return next
}
