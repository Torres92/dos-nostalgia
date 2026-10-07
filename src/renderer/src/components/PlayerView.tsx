import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEntry, LaunchMode } from '../../../shared/types'
import { Button } from '@renderer/components/ui/button'
import { DosConfirmDialog } from '@renderer/components/DosConfirmDialog'
import { DosSupportDialog } from '@renderer/components/DosSupportDialog'
import {
  DEFAULT_DOS_PLAYER_OPTIONS,
  loadDosAssets,
  toArrayBuffer,
  type DosCommandInterface,
  type DosPlayerHandle
} from '@renderer/lib/dos-player'
import { attachIntegerCanvasScale } from '@renderer/lib/integer-canvas-scale'
import { reportError, reportLog } from '@renderer/lib/report-error'
import { cn } from '@renderer/lib/utils'

export type SetupExitAction = 'library' | 'play'

interface PlayerViewProps {
  game: GameEntry
  mode: LaunchMode
  entryFile?: string | null
  onExit: (next?: SetupExitAction) => void
}

interface FsNode {
  name: string
  size: number | null
  nodes: FsNode[] | null
}

/** Setup/save-ish files when fsTree fallback is used (persist-zip writes the full dump). */
const CONFIG_NAME_RE =
  /\.(cfg|ini|set|dat|sav|cnf|fil|ck[1-6])$/i

function isLikelyPersistFile(path: string): boolean {
  const base = path.split('/').pop() ?? path
  if (CONFIG_NAME_RE.test(base)) return true
  // Keen: CONFIG.CK6, SAVEGx.CK4; Raptor: SETUP.INI, CHAR0000.FIL
  if (/^(config|setup|sound|setsound|save|char\d*)/i.test(base)) return true
  if (/setup|sound|config/i.test(base)) return true
  return false
}

function walkFsFiles(node: FsNode, prefix = ''): string[] {
  const here = prefix ? `${prefix}/${node.name}` : node.name
  if (!node.nodes) {
    return node.name && node.name !== '.' ? [here.replace(/^\//, '')] : []
  }
  const out: string[] = []
  for (const child of node.nodes) {
    out.push(...walkFsFiles(child, here === '.' || here === '' ? '' : here))
  }
  return out
}

function normalizeFsPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^[a-zA-Z]:\//, '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
}

async function persistEmulatorToDisk(
  ci: DosCommandInterface,
  directory: string,
  title: string
): Promise<{ written: number; files: string[]; method: string }> {
  // Full FS dump is more reliable than onlyChanges for setup tools.
  let zip = await ci.persist(false).catch(() => null)
  if (!zip || zip.byteLength === 0) {
    zip = await ci.persist(true).catch(() => null)
  }
  if (zip && zip.byteLength > 0) {
    const result = await window.api.applyPersistedChanges(directory, toArrayBuffer(zip))
    return { ...result, method: 'persist-zip' }
  }

  if (!ci.fsTree || !ci.fsReadFile) {
    reportLog('warn', 'Setup persist: no zip and no fsTree API', { title })
    return { written: 0, files: [], method: 'none' }
  }

  const tree = await ci.fsTree()
  const allPaths = walkFsFiles(tree)
    .map(normalizeFsPath)
    .filter(Boolean)
    .filter((path) => !path.startsWith('.jsdos'))

  const configPaths = allPaths.filter(isLikelyPersistFile)
  const targets = configPaths.length > 0 ? configPaths : allPaths

  const files: Array<{ relativePath: string; data: ArrayBuffer }> = []
  for (const relativePath of targets) {
    try {
      const data = await ci.fsReadFile(relativePath)
      files.push({ relativePath, data: toArrayBuffer(data) })
    } catch {
      try {
        const data = await ci.fsReadFile(`C:/${relativePath}`)
        files.push({ relativePath, data: toArrayBuffer(data) })
      } catch {
        // skip unreadable
      }
    }
  }

  if (files.length === 0) {
    return { written: 0, files: [], method: 'fs-empty' }
  }

  const result = await window.api.writeGameFiles(directory, files)
  return { ...result, method: 'fs-tree' }
}

export function PlayerView({
  game,
  mode,
  entryFile = null,
  onExit
}: PlayerViewProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const ciRef = useRef<DosCommandInterface | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [supportMessage, setSupportMessage] = useState<string | null>(null)
  const [supportOpen, setSupportOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [exitConfirm, setExitConfirm] = useState<SetupExitAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [exitBanner, setExitBanner] = useState<string | null>(null)

  const isSetup =
    mode === 'setup' || Boolean(entryFile && /setup|config|setsound|setm|setblast/i.test(entryFile))
  const isArchive = game.kind === 'zip' || game.kind === 'rar'
  /** Folder/exe games: setup config AND in-game saves live in the emulator FS until we write back. */
  const canPersistDisk =
    !isArchive && (game.kind === 'folder' || game.kind === 'executable')
  const entryLabel = entryFile || (isSetup ? game.setupPath?.split('/').pop() : game.filename)
  const headerTitle = isSetup || entryFile
    ? `${game.title} — ${entryLabel ?? 'SETUP'}`
    : game.title

  useEffect(() => {
    let cancelled = false
    void window.api.isFullscreen().then((value) => {
      if (!cancelled) setFullscreen(value)
    })
    const unsubscribe = window.api.onFullscreenChanged((value) => {
      if (!cancelled) setFullscreen(value)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (exitConfirm) return
      if (event.altKey && event.key === 'Enter') {
        event.preventDefault()
        void window.api.toggleFullscreen()
        return
      }
      if (event.key === 'Escape' && fullscreen) {
        event.preventDefault()
        void window.api.setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, exitConfirm])

  const requestExit = useCallback(
    (next: SetupExitAction = 'library'): void => {
      if (saving) return
      setExitConfirm(next)
    },
    [saving]
  )

  useEffect(() => {
    let cancelled = false
    let player: DosPlayerHandle | null = null
    let blobUrl: string | null = null
    let detachIntegerScale: (() => void) | null = null
    const hostElement = hostRef.current

    const cleanupPlayer = async (): Promise<void> => {
      detachIntegerScale?.()
      detachIntegerScale = null
      const playerToStop = player
      player = null
      if (playerToStop) {
        await playerToStop.stop().catch(() => undefined)
      }
      ciRef.current = null
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        blobUrl = null
      }
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
    }

    const startPlayer = async (): Promise<void> => {
      setStatus('loading')
      setErrorMessage(null)
      setSupportMessage(null)
      setSaveNote(null)
      reportLog('info', isSetup ? 'Starting setup' : 'Starting game', {
        title: game.title,
        path: game.path,
        kind: game.kind,
        mode,
        setupPath: game.setupPath,
        entryFile
      })

      try {
        await loadDosAssets()
        if (cancelled || !hostElement || !window.Dos) return

        const bundleBuffer = toArrayBuffer(
          await window.api.buildBundle(game, mode, entryFile)
        )
        if (cancelled) return

        blobUrl = URL.createObjectURL(new Blob([bundleBuffer], { type: 'application/zip' }))
        hostElement.innerHTML = ''

        const emulatorsPathPrefix = new URL('js-dos/emulators/', window.location.href).href

        player = window.Dos(hostElement, {
          ...DEFAULT_DOS_PLAYER_OPTIONS,
          url: blobUrl,
          pathPrefix: emulatorsPathPrefix,
          onEvent: (event, arg) => {
            if (cancelled) return
            if ((event === 'ci-ready' || event === 'emu-ready') && arg && typeof arg === 'object') {
              const maybeCi = arg as DosCommandInterface
              if (typeof maybeCi.persist === 'function') {
                ciRef.current = maybeCi
              }
            }
            if (event === 'emu-ready' || event === 'ci-ready') {
              setStatus('ready')
            }
          }
        })
        detachIntegerScale = attachIntegerCanvasScale(hostElement)

        if (cancelled) {
          await cleanupPlayer()
          return
        }

        window.setTimeout(() => {
          if (!cancelled) setStatus((current) => (current === 'loading' ? 'ready' : current))
        }, 5000)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Error al iniciar el juego.'
        reportError(isSetup ? 'Setup launch failed' : 'Game launch failed', {
          title: game.title,
          path: game.path,
          mode
        }, err)
        setStatus('error')
        setErrorMessage(message)
      }
    }

    void startPlayer()

    return () => {
      cancelled = true
      void cleanupPlayer()
      void window.api.setFullscreen(false)
    }
  }, [game, mode, entryFile, isSetup, isArchive])

  const pauseForNote = (ms = 900): Promise<void> =>
    new Promise((resolve) => window.setTimeout(resolve, ms))

  const saveEmulatorToDisk = async (
    reason: 'setup' | 'play-exit'
  ): Promise<'ok' | 'empty' | 'error'> => {
    if (!canPersistDisk) {
      setSaveNote(
        isArchive
          ? 'Este juego está en ZIP/RAR: config/partidas no se escriben al archivo. Descomprimí en carpeta.'
          : 'No se puede guardar en disco para este tipo de juego.'
      )
      return 'error'
    }
    const ci = ciRef.current
    if (!ci?.persist) {
      setSaveNote('El emulador aún no está listo para guardar. Esperá un momento e intentá de nuevo.')
      reportLog('warn', `${reason} save: CI missing`, { title: game.title })
      return 'error'
    }
    try {
      const result = await persistEmulatorToDisk(ci, game.directory, game.title)
      reportLog('info', `${reason} write-back result`, {
        title: game.title,
        ...result
      })
      if (result.written > 0) {
        const note =
          reason === 'setup'
            ? `Config guardada (${result.written} archivo(s)).`
            : `Partida/config guardada en disco (${result.written} archivo(s)).`
        setSaveNote(note)
        setExitBanner(note)
        return 'ok'
      }
      const emptyNote =
        reason === 'setup'
          ? 'No se detectaron archivos nuevos. Si configuraste algo, probá otra vez o revisá que el juego esté en carpeta.'
          : 'No hubo cambios para escribir en disco (¿el juego guardó en C:?).'
      setSaveNote(emptyNote)
      setExitBanner(emptyNote)
      return 'empty'
    } catch (err) {
      reportError(`Failed to persist ${reason} changes`, { title: game.title }, err)
      const message = err instanceof Error ? err.message : 'No se pudo guardar en disco.'
      setSaveNote(message)
      setExitBanner(message)
      return 'error'
    }
  }

  const handleFinishSetup = async (next: SetupExitAction): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const result = await saveEmulatorToDisk('setup')
      await pauseForNote(result === 'ok' ? 900 : 1200)
      if (result === 'error' && !isArchive) {
        return
      }
      void window.api.setFullscreen(false)
      onExit(next)
    } finally {
      setSaving(false)
    }
  }

  const handleExitPlay = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      if (canPersistDisk) {
        await saveEmulatorToDisk('play-exit')
        await pauseForNote(900)
      }
      void window.api.setFullscreen(false)
      onExit('library')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenLogs = async (): Promise<void> => {
    try {
      await window.api.openLogsFolder()
      setSupportMessage('Carpeta de logs abierta.')
    } catch (err) {
      setSupportMessage(err instanceof Error ? err.message : 'No se pudo abrir la carpeta de logs.')
    }
  }

  const handleToggleFullscreen = (): void => {
    void window.api.toggleFullscreen()
  }

  const handleExit = (): void => {
    if (status === 'error') {
      void window.api.setFullscreen(false)
      onExit('library')
      return
    }
    requestExit('library')
  }

  const handleConfirmExit = (): void => {
    const next = exitConfirm
    setExitConfirm(null)
    if (!next) return
    if (isSetup) {
      void handleFinishSetup(next)
      return
    }
    void handleExitPlay()
  }

  const exitConfirmMessage =
    exitConfirm === 'play'
      ? '¿Guardar la config y pasar a jugar? Se intentará escribir en disco.'
      : isSetup
        ? '¿Salir del SETUP y volver a la biblioteca? Se intentará guardar la config en disco.'
        : canPersistDisk
          ? '¿Salir del juego y volver a la biblioteca? Se intentará guardar la partida/config en disco.'
          : '¿Salir del juego y volver a la biblioteca?'

  return (
    <div className={cn('dos-shell relative', fullscreen ? '!p-0' : '!p-2')}>
      <div className={cn('dos-window relative', fullscreen && '!border-0 !shadow-none')}>
        <div
          className={cn(
            'dos-titlebar',
            fullscreen &&
              'absolute inset-x-0 top-0 z-20 border-b-2 border-[var(--dos-white)] bg-[var(--dos-black)]/95'
          )}
        >
          <Button variant="ghost" size="sm" onClick={handleExit} disabled={saving}>
            {saving ? 'Saving…' : '► Back'}
          </Button>
          <span className="dos-titlebar__sep">│</span>
          <span className="min-w-0 flex-1 truncate text-[var(--dos-yellow)]">{headerTitle}</span>
          <Button variant="ghost" size="sm" onClick={handleToggleFullscreen} title="Alt+Enter">
            {fullscreen ? '► Window' : '► Fullscreen'}
          </Button>
          {!fullscreen && (
            <span className="dos-muted text-[16px]">
              {isSetup ? 'SETUP' : game.filename} [{game.kind.toUpperCase()}]
            </span>
          )}
        </div>

        {isSetup && (
          <div
            className={cn(
              'space-y-2 border-b-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-3 py-2',
              fullscreen && 'absolute inset-x-0 top-10 z-20'
            )}
          >
            <p className="text-[16px] text-[var(--dos-cyan)]">
              {isArchive
                ? 'Setup en ZIP/RAR: la config NO se guarda en el archivo. Descomprimí el juego en una carpeta.'
                : 'Teclado/mouse en SETUP: cursor libre para menús y sensibilidad. F10 = Accept.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="yellow"
                size="sm"
                disabled={saving || isArchive}
                onClick={() => requestExit('play')}
              >
                {saving ? 'Saving…' : '► Guardar y jugar'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || isArchive}
                onClick={() => requestExit('library')}
              >
                ► Guardar y volver
              </Button>
            </div>
            {(exitBanner || saveNote) && (
              <p className="text-[15px] text-[var(--dos-yellow)]">{exitBanner ?? saveNote}</p>
            )}
          </div>
        )}

        {!isSetup && canPersistDisk && (exitBanner || saveNote) && (
          <div
            className={cn(
              'border-b-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-3 py-2',
              fullscreen && 'absolute inset-x-0 top-10 z-20'
            )}
          >
            <p className="text-[15px] text-[var(--dos-yellow)]">{exitBanner ?? saveNote}</p>
          </div>
        )}

        {!isSetup && isArchive && !fullscreen && (
          <div className="border-b-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-3 py-2">
            <p className="text-[16px] text-[var(--dos-cyan)]">
              ZIP/RAR: las partidas guardadas en el juego se pierden al cerrar. Descomprimí en carpeta para
              persistir.
            </p>
          </div>
        )}

        <div className="relative min-h-0 flex-1 bg-black">
          {status === 'loading' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--dos-blue)]">
              <p>
                {isSetup ? 'Preparing SETUP…' : 'Preparing DOSBox-X…'}
                <span className="dos-cursor" />
              </p>
              <p className="dos-muted text-[16px]">Mounting bundle</p>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[var(--dos-blue)] px-6 text-center">
              <div className="dos-section-bar w-full max-w-lg text-left">Launch error</div>
              <p className="dos-danger max-w-lg">{errorMessage}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={handleExit}>► Back</Button>
                <Button variant="yellow" onClick={() => setSupportOpen(true)}>
                  ► Reportar
                </Button>
                <Button variant="ghost" onClick={handleOpenLogs}>
                  ► Open logs
                </Button>
              </div>
              {supportMessage && <p className="dos-muted text-[16px]">{supportMessage}</p>}
            </div>
          )}
          <div ref={hostRef} className="player-host h-full w-full" />
        </div>

        {exitConfirm && (
          <DosConfirmDialog
            title={exitConfirm === 'play' ? 'CONFIRMAR' : 'SALIR'}
            message={exitConfirmMessage}
            confirmLabel={exitConfirm === 'play' ? '► Sí, jugar' : '► Sí, salir'}
            cancelLabel="► Seguir"
            onConfirm={handleConfirmExit}
            onCancel={() => setExitConfirm(null)}
          />
        )}

        {supportOpen && errorMessage && (
          <DosSupportDialog
            errorSummary={errorMessage}
            contextLabel={isSetup ? 'Setup launch' : 'Game launch'}
            onClose={() => setSupportOpen(false)}
          />
        )}
      </div>
      {!fullscreen && (
        <footer className="dos-statusbar">
          <span>
            {isSetup ? (
              <>
                Terminá el SETUP → <strong>Guardar y jugar</strong> o <strong>Guardar y volver</strong>
              </>
            ) : (
              <>
                <strong>Clic</strong> en pantalla (Raptor/shooters captura mouse) · <strong>Esc</strong> ·{' '}
                <strong>Back</strong> pide confirmación · <strong>Alt+Enter</strong>
                {isArchive ? ' · ZIP/RAR no persiste' : ''}
              </>
            )}
          </span>
        </footer>
      )}
    </div>
  )
}
