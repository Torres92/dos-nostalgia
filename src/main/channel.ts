import { app } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import type { DistributionChannel } from '../shared/updates'

/**
 * Steam builds should never self-update (Steam owns the bits).
 * Override with DOS_NOSTALGIA_CHANNEL=steam|direct for CI / local tests.
 */
export function detectDistributionChannel(): DistributionChannel {
  const forced = process.env.DOS_NOSTALGIA_CHANNEL?.trim().toLowerCase()
  if (forced === 'steam' || forced === 'direct') return forced

  if (process.env.SteamAppId || process.env.SteamGameId || process.env.SteamClientLaunch) {
    return 'steam'
  }

  try {
    const exeDir = dirname(app.getPath('exe'))
    if (existsSync(join(exeDir, 'steam_appid.txt'))) return 'steam'
    // Common layout: .../steamapps/common/DOS Nostalgia/...
    if (/[\\/]steamapps[\\/]/i.test(exeDir)) return 'steam'
  } catch {
    // ignore — fall through to direct
  }

  return 'direct'
}
