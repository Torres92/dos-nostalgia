import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppSettings, GameEntry, LaunchMode, UpdateCheckResult } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { DosShell } from '@renderer/components/DosShell'
import { TopBar } from '@renderer/components/TopBar'
import { GameGrid } from '@renderer/components/GameGrid'
import { SettingsView } from '@renderer/components/SettingsView'
import { AboutView } from '@renderer/components/AboutView'
import { PlayerView } from '@renderer/components/PlayerView'
import { LegalGateView } from '@renderer/components/LegalGateView'
import { UpdateBanner } from '@renderer/components/UpdateBanner'
import { reportError, reportLog } from '@renderer/lib/report-error'

type View = 'games' | 'settings' | 'about'

function App(): React.JSX.Element {
  const [view, setView] = useState<View>('games')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [settingsReady, setSettingsReady] = useState(false)
  const [games, setGames] = useState<GameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playingGame, setPlayingGame] = useState<GameEntry | null>(null)
  const [launchMode, setLaunchMode] = useState<LaunchMode>('play')
  const [launchEntryFile, setLaunchEntryFile] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)

  const refreshLibrary = useCallback(async (): Promise<void> => {
    setScanning(true)
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.scanGames()
      setGames(result.games)
      setError(result.error ?? null)
      reportLog('info', 'Library refreshed', {
        gameCount: result.games.length,
        error: result.error ?? null
      })
      if (result.games.length > 0) {
        setSelectedId((previousId) =>
          previousId && result.games.some((game) => game.id === previousId)
            ? previousId
            : result.games[0].id
        )
      } else {
        setSelectedId(null)
      }
    } catch (err) {
      setGames([])
      const message = err instanceof Error ? err.message : 'Error al escanear.'
      reportError('Library refresh failed', {}, err)
      setError(message)
    } finally {
      setScanning(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const boot = async (): Promise<void> => {
      let loaded = DEFAULT_SETTINGS
      try {
        loaded = await window.api.getSettings()
        setSettings(loaded)
      } catch (err) {
        reportError('Failed to load settings on boot', {}, err)
        setSettings(DEFAULT_SETTINGS)
      } finally {
        setSettingsReady(true)
      }
      if (loaded.legalAcceptedAt) {
        await refreshLibrary()
      } else {
        setLoading(false)
      }
    }
    void boot()
  }, [refreshLibrary])

  useEffect(() => {
    if (!settings.legalAcceptedAt) return
    let cancelled = false
    void window.api
      .checkForUpdates()
      .then((result) => {
        if (cancelled) return
        setUpdateInfo(result)
        reportLog('info', 'Update check', {
          status: result.status,
          channel: result.channel,
          latestVersion: result.latestVersion ?? null
        })
      })
      .catch((err) => reportError('Update check failed', {}, err))
    return () => {
      cancelled = true
    }
  }, [settings.legalAcceptedAt])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'F2') {
        event.preventDefault()
        setView('settings')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filteredGames = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return games
    return games.filter(
      (game) =>
        game.title.toLowerCase().includes(query) ||
        game.filename.toLowerCase().includes(query) ||
        game.path.toLowerCase().includes(query)
    )
  }, [games, filter])

  const handleSaveSettings = async (nextSettings: AppSettings): Promise<void> => {
    const saved = await window.api.setSettings(nextSettings)
    setSettings(saved)
    await refreshLibrary()
  }

  const handleAcceptLegal = async (): Promise<void> => {
    const saved = await window.api.setSettings({
      ...settings,
      legalAcceptedAt: new Date().toISOString()
    })
    setSettings(saved)
    reportLog('info', 'Legal terms accepted', { legalAcceptedAt: saved.legalAcceptedAt })
    await refreshLibrary()
  }

  const openGame = (
    game: GameEntry,
    mode: LaunchMode = 'play',
    entryFile?: string
  ): void => {
    setSelectedId(game.id)
    setLaunchMode(mode)
    setLaunchEntryFile(entryFile?.trim() ? entryFile.trim() : null)
    setPlayingGame(game)
    reportLog('info', mode === 'setup' ? 'Opening setup from library' : 'Opening game from library', {
      title: game.title,
      path: game.path,
      kind: game.kind,
      mode,
      setupPath: game.setupPath,
      entryFile: entryFile ?? null
    })
  }

  if (!settingsReady) {
    return (
      <div className="dos-shell !p-2">
        <div className="dos-window flex items-center justify-center">
          <p>
            Loading…<span className="dos-cursor" />
          </p>
        </div>
      </div>
    )
  }

  if (!settings.legalAcceptedAt) {
    return <LegalGateView onAccept={handleAcceptLegal} />
  }

  if (playingGame) {
    return (
      <PlayerView
        key={`${playingGame.id}:${launchMode}:${launchEntryFile ?? ''}`}
        game={playingGame}
        mode={launchMode}
        entryFile={launchEntryFile}
        onExit={(next) => {
          if (next === 'play') {
            setLaunchMode('play')
            setLaunchEntryFile(null)
            return
          }
          setPlayingGame(null)
          setLaunchMode('play')
          setLaunchEntryFile(null)
        }}
      />
    )
  }

  const statusRight =
    view === 'games'
      ? `${filteredGames.length} game(s)`
      : view === 'settings'
        ? 'SETUP.EXE'
        : 'ABOUT.TXT'

  const showUpdateBanner =
    !updateDismissed && updateInfo?.status === 'available' ? updateInfo : null

  return (
    <DosShell
      statusLeft={scanning ? 'Scanning…' : settings.gamesFolder || 'No folder'}
      statusRight={statusRight}
    >
      {showUpdateBanner && (
        <UpdateBanner result={showUpdateBanner} onDismiss={() => setUpdateDismissed(true)} />
      )}
      <TopBar
        view={view}
        filter={filter}
        onFilterChange={setFilter}
        onViewChange={setView}
        gameCount={filteredGames.length}
      />
      <main className="dos-panel-body flex min-h-0 flex-1 flex-col">
        {view === 'settings' ? (
          <SettingsView
            key={`${settings.gamesFolder}\0${settings.coversFolder}`}
            settings={settings}
            scanning={scanning}
            onSave={handleSaveSettings}
            onRescan={refreshLibrary}
          />
        ) : view === 'about' ? (
          <AboutView />
        ) : (
          <GameGrid
            games={filteredGames}
            loading={loading}
            error={error && settings.gamesFolder ? error : null}
            filter={filter}
            selectedId={selectedId}
            hasFolder={Boolean(settings.gamesFolder)}
            onSelect={setSelectedId}
            onOpen={openGame}
            onOpenSettings={() => setView('settings')}
            onRescan={refreshLibrary}
          />
        )}
      </main>
    </DosShell>
  )
}

export default App
