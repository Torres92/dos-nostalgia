import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FolderFileEntry, GameEntry, LaunchMode } from '../../../shared/types'
import { Button } from '@renderer/components/ui/button'
import { BrandLogo } from '@renderer/components/BrandLogo'
import { coverSrc, cn } from '@renderer/lib/utils'
import { ARCHIVE_PERSIST_TIP } from '../../../shared/tips'
import { reportError } from '@renderer/lib/report-error'

interface GameGridProps {
  games: GameEntry[]
  loading: boolean
  error: string | null
  filter: string
  selectedId: string | null
  hasFolder: boolean
  onSelect: (id: string) => void
  onOpen: (game: GameEntry, mode?: LaunchMode, entryFile?: string) => void
  onOpenSettings: () => void
  onRescan: () => void
}

function kindLabel(kind: GameEntry['kind']): string {
  if (kind === 'zip') return 'ZIP'
  if (kind === 'rar') return 'RAR'
  if (kind === 'folder') return 'DIR'
  return 'EXE'
}

function fileRoleBadge(role: FolderFileEntry['role']): string {
  if (role === 'setup') return 'SET'
  if (role === 'play') return 'EXE'
  return 'UTIL'
}

function DosEmptyFrame({
  title,
  children,
  actions
}: {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="dos-panel-body flex flex-col items-center justify-center gap-4 p-6 text-center animate-fade-in">
      <div className="dos-section-bar w-full max-w-lg text-left">{title}</div>
      <div className="max-w-lg text-[var(--dos-white)]">{children}</div>
      {actions}
    </div>
  )
}

export function GameGrid({
  games,
  loading,
  error,
  filter,
  selectedId,
  hasFolder,
  onSelect,
  onOpen,
  onOpenSettings,
  onRescan
}: GameGridProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const [browsingFolder, setBrowsingFolder] = useState<GameEntry | null>(null)
  const [folderFiles, setFolderFiles] = useState<FolderFileEntry[]>([])
  const [folderLoading, setFolderLoading] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedId) ?? null,
    [games, selectedId]
  )
  const selectedFile = useMemo(
    () => folderFiles.find((file) => file.id === selectedFileId) ?? null,
    [folderFiles, selectedFileId]
  )
  const cover = selectedGame
    ? coverSrc(selectedGame.coverPath, selectedGame.coverUrl)
    : null

  const exitFolder = useCallback((): void => {
    setBrowsingFolder(null)
    setFolderFiles([])
    setFolderError(null)
    setSelectedFileId(null)
    setFolderLoading(false)
  }, [])

  const enterFolder = useCallback(async (game: GameEntry): Promise<void> => {
    if (game.kind !== 'folder') return
    setFolderLoading(true)
    setFolderError(null)
    setBrowsingFolder(game)
    setSelectedFileId(null)
    try {
      const files = await window.api.listFolder(game.directory)
      setFolderFiles(files)
      const preferred =
        files.find((file) => file.role === 'play') ??
        files.find((file) => file.role === 'setup') ??
        files[0]
      setSelectedFileId(preferred?.id ?? null)
    } catch (err) {
      reportError('Failed to list folder', { directory: game.directory }, err)
      setFolderFiles([])
      setFolderError(err instanceof Error ? err.message : 'No se pudo abrir la carpeta.')
    } finally {
      setFolderLoading(false)
    }
  }, [])

  const launchFolderFile = useCallback(
    (game: GameEntry, file: FolderFileEntry): void => {
      const mode: LaunchMode = file.role === 'setup' ? 'setup' : 'play'
      onOpen(game, mode, file.name)
    },
    [onOpen]
  )

  useEffect(() => {
    // Leave browse mode if the parent folder disappears after rescan.
    if (browsingFolder && !games.some((game) => game.id === browsingFolder.id)) {
      exitFolder()
    }
  }, [games, browsingFolder, exitFolder])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      if (browsingFolder) {
        if (folderFiles.length === 0) {
          if (event.key === 'Backspace' || event.key === 'Escape') {
            event.preventDefault()
            exitFolder()
          }
          return
        }
        const currentIndex = Math.max(
          0,
          folderFiles.findIndex((file) => file.id === selectedFileId)
        )
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          const next = folderFiles[Math.min(folderFiles.length - 1, currentIndex + 1)]
          setSelectedFileId(next.id)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          const prev = folderFiles[Math.max(0, currentIndex - 1)]
          setSelectedFileId(prev.id)
        } else if (event.key === 'Enter' && selectedFile) {
          event.preventDefault()
          launchFolderFile(browsingFolder, selectedFile)
        } else if (event.key === 'Backspace' || event.key === 'Escape') {
          event.preventDefault()
          exitFolder()
        } else if (event.key === 'F2') {
          event.preventDefault()
          onOpenSettings()
        }
        return
      }

      if (games.length === 0) return
      const currentIndex = Math.max(
        0,
        games.findIndex((game) => game.id === selectedId)
      )

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const next = games[Math.min(games.length - 1, currentIndex + 1)]
        onSelect(next.id)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        const prev = games[Math.max(0, currentIndex - 1)]
        onSelect(prev.id)
      } else if (event.key === 'Enter' && selectedGame) {
        event.preventDefault()
        if (selectedGame.kind === 'folder') {
          void enterFolder(selectedGame)
        } else {
          onOpen(selectedGame, 'play')
        }
      } else if (event.key.toLowerCase() === 's' && selectedGame?.hasSetup) {
        event.preventDefault()
        onOpen(selectedGame, 'setup')
      } else if (event.key === 'F2') {
        event.preventDefault()
        onOpenSettings()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    games,
    selectedId,
    selectedGame,
    onSelect,
    onOpen,
    onOpenSettings,
    browsingFolder,
    folderFiles,
    selectedFileId,
    selectedFile,
    enterFolder,
    exitFolder,
    launchFolderFile
  ])

  useEffect(() => {
    if (!listRef.current) return
    const id = browsingFolder ? selectedFileId : selectedId
    if (!id) return
    const rows = listRef.current.querySelectorAll<HTMLElement>('[data-row-id]')
    for (const row of rows) {
      if (row.getAttribute('data-row-id') === id) {
        row.scrollIntoView({ block: 'nearest' })
        break
      }
    }
  }, [selectedId, selectedFileId, browsingFolder])

  if (loading) {
    return (
      <DosEmptyFrame title="Biblioteca">
        <p>
          Escaneando colección…<span className="dos-cursor" />
        </p>
      </DosEmptyFrame>
    )
  }

  if (error) {
    return (
      <DosEmptyFrame
        title="Error"
        actions={
          <div className="flex gap-2">
            <Button onClick={onOpenSettings}>Abrir ajustes</Button>
            <Button variant="ghost" onClick={onRescan}>
              Reintentar
            </Button>
          </div>
        }
      >
        <p className="dos-danger">{error}</p>
      </DosEmptyFrame>
    )
  }

  if (!hasFolder) {
    return (
      <DosEmptyFrame
        title="Bienvenido"
        actions={
          <Button variant="yellow" size="lg" onClick={onOpenSettings}>
            ► Configurar carpeta
          </Button>
        }
      >
        <BrandLogo className="mx-auto mb-2 h-20 w-20" />
        <p>
          DOS Nostalgia
          <span className="dos-cursor" />
        </p>
        <p className="mt-2 dos-muted">
          Elige la carpeta con tus juegos (.zip / .rar / .exe) para montar la biblioteca.
        </p>
        <p className="mt-3 max-w-lg text-[16px] text-[var(--dos-cyan)]">{ARCHIVE_PERSIST_TIP}</p>
      </DosEmptyFrame>
    )
  }

  if (games.length === 0) {
    return (
      <DosEmptyFrame
        title={filter.trim() ? 'Sin resultados' : 'Carpeta vacía'}
        actions={
          !filter.trim() ? (
            <Button variant="ghost" onClick={onRescan}>
              ► Volver a escanear
            </Button>
          ) : undefined
        }
      >
        <p className="dos-muted">
          {filter.trim()
            ? `Ningún juego coincide con “${filter.trim()}”.`
            : 'No se encontraron .exe, .com, .bat, .zip o .rar.'}
        </p>
        {!filter.trim() && (
          <p className="mt-3 max-w-lg text-[16px] text-[var(--dos-cyan)]">{ARCHIVE_PERSIST_TIP}</p>
        )}
      </DosEmptyFrame>
    )
  }

  const insideFolder = Boolean(browsingFolder)

  return (
    <div className="dos-panel-body grid min-h-0 grid-cols-1 lg:grid-cols-[1fr_240px] animate-fade-in">
      <div ref={listRef} className="min-h-0 overflow-y-auto">
        <div className="dos-section-bar">
          {insideFolder ? `DIR:\\${browsingFolder!.title}` : 'Game library'}
        </div>
        {insideFolder ? (
          folderLoading ? (
            <p className="p-3 dos-muted">
              Leyendo carpeta…<span className="dos-cursor" />
            </p>
          ) : folderError ? (
            <p className="p-3 dos-danger">{folderError}</p>
          ) : folderFiles.length === 0 ? (
            <p className="p-3 dos-muted">No hay .exe / .com / .bat en esta carpeta.</p>
          ) : (
            <ul className="dos-menu" role="listbox" aria-label="Archivos del juego">
              {folderFiles.map((file) => {
                const selected = selectedFileId === file.id
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-row-id={file.id}
                      title={file.path}
                      className={cn('dos-menu-item', selected && 'is-selected')}
                      onClick={() => setSelectedFileId(file.id)}
                      onDoubleClick={() => launchFolderFile(browsingFolder!, file)}
                    >
                      <span className="dos-arrow" aria-hidden>
                        ►
                      </span>
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="dos-badge">[{fileRoleBadge(file.role)}]</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <ul className="dos-menu" role="listbox" aria-label="Lista de juegos">
            {games.map((game) => {
              const selected = selectedId === game.id
              return (
                <li key={game.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-row-id={game.id}
                    title={game.path}
                    className={cn('dos-menu-item', selected && 'is-selected')}
                    onClick={() => onSelect(game.id)}
                    onDoubleClick={() => {
                      if (game.kind === 'folder') {
                        void enterFolder(game)
                      } else {
                        onOpen(game, 'play')
                      }
                    }}
                  >
                    <span className="dos-arrow" aria-hidden>
                      ►
                    </span>
                    <span className="min-w-0 flex-1 truncate">{game.title}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {game.hasSetup && <span className="dos-badge">[SET]</span>}
                      <span className="dos-badge">[{kindLabel(game.kind)}]</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-2 dos-section-bar">Actions</div>
        <ul className="dos-menu">
          {insideFolder ? (
            <>
              <li>
                <button type="button" className="dos-menu-item" onClick={exitFolder}>
                  <span className="dos-arrow">►</span>
                  Back to library
                </button>
              </li>
              {selectedFile && browsingFolder && (
                <li>
                  <button
                    type="button"
                    className="dos-menu-item"
                    onClick={() => launchFolderFile(browsingFolder, selectedFile)}
                  >
                    <span className="dos-arrow">►</span>
                    {selectedFile.role === 'setup' ? 'Run setup / config' : 'Run selected'}
                  </button>
                </li>
              )}
            </>
          ) : (
            <>
              <li>
                <button type="button" className="dos-menu-item" onClick={onOpenSettings}>
                  <span className="dos-arrow">►</span>
                  Settings / carpeta
                </button>
              </li>
              <li>
                <button type="button" className="dos-menu-item" onClick={onRescan}>
                  <span className="dos-arrow">►</span>
                  Rescan library
                </button>
              </li>
              {selectedGame?.kind === 'folder' && (
                <li>
                  <button
                    type="button"
                    className="dos-menu-item"
                    onClick={() => void enterFolder(selectedGame)}
                  >
                    <span className="dos-arrow">►</span>
                    Enter folder
                  </button>
                </li>
              )}
              {selectedGame && (
                <>
                  <li>
                    <button
                      type="button"
                      className="dos-menu-item"
                      onClick={() => onOpen(selectedGame, 'play')}
                    >
                      <span className="dos-arrow">►</span>
                      Play selected
                    </button>
                  </li>
                  {selectedGame.hasSetup && (
                    <li>
                      <button
                        type="button"
                        className="dos-menu-item"
                        onClick={() => onOpen(selectedGame, 'setup')}
                      >
                        <span className="dos-arrow">►</span>
                        Setup / config
                      </button>
                    </li>
                  )}
                </>
              )}
            </>
          )}
        </ul>
      </div>

      <aside className="hidden border-l-2 border-[var(--dos-white)] lg:flex lg:flex-col">
        <div className="dos-section-bar">Preview</div>
        <div className="flex flex-1 flex-col gap-3 p-3">
          {insideFolder && browsingFolder ? (
            <>
              <p className="truncate text-[var(--dos-yellow)]">{browsingFolder.title}</p>
              <p className="text-[16px] dos-muted">Contenido de la carpeta</p>
              {selectedFile ? (
                <>
                  <p className="truncate text-[var(--dos-cyan)]">{selectedFile.name}</p>
                  <p className="text-[15px] dos-muted">
                    {selectedFile.role === 'setup'
                      ? 'Configuración / sonido / controles'
                      : selectedFile.role === 'play'
                        ? 'Ejecutable principal del juego'
                        : 'Utilidad u otro programa DOS'}
                  </p>
                  <Button
                    variant="yellow"
                    onClick={() => launchFolderFile(browsingFolder, selectedFile)}
                  >
                    ► {selectedFile.role === 'setup' ? 'SETUP' : 'RUN'}
                  </Button>
                </>
              ) : (
                <p className="dos-muted">Selecciona un .exe</p>
              )}
              <Button variant="ghost" onClick={exitFolder}>
                ► Back
              </Button>
            </>
          ) : selectedGame ? (
            <>
              <div className="aspect-[3/4] w-full overflow-hidden border-2 border-[var(--dos-white)] bg-[var(--dos-black)]">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ imageRendering: 'auto' }}
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full items-end p-3 text-[var(--dos-cyan)]">
                    {selectedGame.title}
                  </div>
                )}
              </div>
              <p className="truncate text-[var(--dos-yellow)]">{selectedGame.title}</p>
              <p className="truncate text-[16px] dos-muted">
                {selectedGame.kind === 'folder'
                  ? `Carpeta · Play: ${selectedGame.filename}`
                  : selectedGame.filename}
              </p>
              {selectedGame.hasSetup && (
                <p className="text-[16px] text-[var(--dos-cyan)]">
                  Setup: {selectedGame.setupPath?.split('/').pop() ?? 'SETUP'} · tecla S
                </p>
              )}
              {(selectedGame.kind === 'zip' || selectedGame.kind === 'rar') && (
                <p className="text-[15px] leading-snug text-[var(--dos-cyan)]">
                  Archivo comprimido: OK para jugar. Para SETUP, config o partidas, descomprimí en
                  una carpeta y reseaneá.
                </p>
              )}
              {selectedGame.kind === 'folder' && (
                <p className="text-[15px] leading-snug dos-muted">
                  Doble clic o Enter: entrar a la carpeta. O usá PLAY / SETUP sin entrar.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {selectedGame.kind === 'folder' && (
                  <Button variant="ghost" onClick={() => void enterFolder(selectedGame)}>
                    ► ENTER FOLDER
                  </Button>
                )}
                <Button variant="yellow" onClick={() => onOpen(selectedGame, 'play')}>
                  ► PLAY
                </Button>
                {selectedGame.hasSetup && (
                  <Button variant="ghost" onClick={() => onOpen(selectedGame, 'setup')}>
                    ► SETUP
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="dos-muted">Selecciona un juego</p>
          )}
        </div>
      </aside>
    </div>
  )
}
