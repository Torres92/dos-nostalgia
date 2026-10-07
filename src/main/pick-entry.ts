import { basename, dirname } from 'path'

const EXEC_RE = /\.(exe|com|bat)$/i

/** Setup / sound config tools the user may want to run explicitly (Play + Setup). */
const SETUP_STEM_RE =
  /^(setup|configure|config|setsound|setm|setblast|sound|uvconfig)$/i

/** Setup, extenders, docs and other launchers we should almost never autoexec. */
const UTIL_RE =
  /^(setup|install|installe?r?|configure|config|setsound|setm|setblast|sound|uvconfig|dos4gw|cwsdpmi?|himem|emm386|smartdrv|mouse|ctmouse|readme|order|catalog|register|deice|pkunzip|unzip|unrar|logo|intro|copying|file_?id|memtest|chkdsk|mode|keyb|mscdex|sbbp|sb16|ultramid|midpak|doomhack|help|raphelp|dealers|apogee|swcbbs|modex|sample|utils?)$/i

const SETUP_PRIORITY = ['setup', 'setsound', 'setm', 'setblast', 'configure', 'config', 'sound', 'uvconfig']

export function isExecutableName(name: string): boolean {
  return EXEC_RE.test(name)
}

/** True for setup/sound/extender/docs launchers that should not appear as games. */
export function isUtilityExecutable(name: string): boolean {
  const base = basename(name).toLowerCase()
  if (!EXEC_RE.test(base)) return false
  const stem = normalizeStem(base.replace(EXEC_RE, ''))
  return UTIL_RE.test(stem)
}

/** Primary playable game EXE (not setup / help / catalog / BBS extras). */
export function isPrimaryPlayExecutable(name: string): boolean {
  return isExecutableName(name) && !isUtilityExecutable(name)
}

/** Setup / sound configuration utilities (subset of utilities). */
export function isSetupExecutable(name: string): boolean {
  const base = basename(name).toLowerCase()
  if (!EXEC_RE.test(base)) return false
  const stem = normalizeStem(base.replace(EXEC_RE, ''))
  return SETUP_STEM_RE.test(stem)
}

/** Turn a zip-relative path into a DOS autoexec command (optional cd + basename). */
export function pathToEntryCommand(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '')
  if (normalized.includes('/')) {
    return `cd ${dirname(normalized).replace(/\//g, '\\')}\n${basename(normalized)}`
  }
  return basename(normalized)
}

/**
 * Pick the best setup/config executable from archive or folder-relative paths.
 * Returns a zip-style relative path, or null if none.
 */
export function pickSetupPath(paths: string[]): string | null {
  const candidates = paths
    .filter((n) => !n.endsWith('/') && isSetupExecutable(n))
    .map((n) => n.replace(/\\/g, '/'))

  if (candidates.length === 0) return null

  const scored = candidates.map((n) => {
    const stem = normalizeStem(basename(n).replace(EXEC_RE, ''))
    const depth = (n.match(/\//g) ?? []).length
    const priority = SETUP_PRIORITY.indexOf(stem)
    let score = priority === -1 ? 50 : priority * 10
    score += depth * 3
    if (/\.exe$/i.test(n)) score -= 2
    return { n, score }
  })

  scored.sort((a, b) => a.score - b.score || a.n.localeCompare(b.n))
  return scored[0].n
}

function normalizeStem(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Significant tokens from a pretty title / archive name for fuzzy EXE matching. */
function titleTokens(title: string): string[] {
  const raw = title
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  const stop = new Set([
    'the',
    'and',
    'of',
    'a',
    'an',
    'for',
    'to',
    'in',
    'on',
    'edition',
    'version',
    'ver',
    'vol',
    'disk',
    'disc',
    'cd',
    'demo',
    'shareware',
    'freeware',
    'registered',
    'full'
  ])

  const tokens = raw.filter((t) => t.length >= 3 && !stop.has(t) && !/^\d{4}$/.test(t))
  return [...new Set(tokens)]
}

function titleMatchScore(stem: string, title: string): number {
  const titleStem = normalizeStem(title)
  if (!titleStem && !stem) return 0

  if (titleStem) {
    if (stem === titleStem) return 45
    if (stem.startsWith(titleStem) || titleStem.startsWith(stem)) return 35
    if (stem.length >= 4 && (titleStem.includes(stem) || stem.includes(titleStem))) return 28
  }

  let best = 0
  for (const token of titleTokens(title)) {
    if (stem === token) best = Math.max(best, 32)
    else if (stem.startsWith(token) || token.startsWith(stem)) best = Math.max(best, 26)
    else if (stem.includes(token) || token.includes(stem)) best = Math.max(best, 18)
  }
  return best
}

/**
 * Choose which DOS program to put in [autoexec] for a zip/rar/folder bundle.
 * Prefers title-matching EXEs; demotes setup/sound/DOS4GW/readme/help/catalog/etc.
 */
export function pickEntryCommand(paths: string[], title = ''): string {
  const exes = paths.filter((n) => isExecutableName(n) && !n.endsWith('/'))
  if (exes.length === 0) return 'dir'

  const scored = exes
    .map((n) => {
      const base = basename(n).toLowerCase()
      const stem = normalizeStem(base.replace(EXEC_RE, ''))
      const depth = (n.match(/\//g) ?? []).length
      let score = 0

      score += Math.max(0, 6 - depth * 3)

      if (/\.exe$/i.test(base)) score += 3
      else if (/\.com$/i.test(base)) score += 2
      else if (/\.bat$/i.test(base)) score += 1

      score += titleMatchScore(stem, title)

      if (/^keen/i.test(base)) score += 18
      if (/^rap(?:tor)?$/i.test(stem)) score += 20
      if (/^(go|start|run|play|game)\./i.test(base)) score += 6

      if (UTIL_RE.test(stem) || UTIL_RE.test(base.replace(EXEC_RE, ''))) {
        score -= 40
      }

      // Slight preference for classic 8.3-ish game names over long util names.
      if (stem.length > 0 && stem.length <= 8) score += 1

      return { n, score }
    })
    .sort((a, b) => b.score - a.score || a.n.localeCompare(b.n))

  const entry = scored[0].n
  if (entry.includes('/')) {
    return `cd ${dirname(entry).replace(/\//g, '\\')}\n${basename(entry)}`
  }
  return entry
}

/** Basename of the preferred play EXE inside a folder (or null). */
export function pickPlayExecutableName(fileNames: string[], title = ''): string | null {
  const primary = fileNames.filter((name) => isPrimaryPlayExecutable(name))
  if (primary.length === 0) return null
  const command = pickEntryCommand(primary, title)
  if (command === 'dir') return null
  const lines = command.split('\n')
  return basename(lines[lines.length - 1] ?? command)
}
