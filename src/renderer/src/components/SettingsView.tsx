import { useEffect, useState } from 'react'
import type { AppInfo, AppSettings } from '../../../shared/types'
import { Button } from '@renderer/components/ui/button'
import { DosSupportDialog } from '@renderer/components/DosSupportDialog'
import { Input } from '@renderer/components/ui/input'
import { reportError } from '@renderer/lib/report-error'
import { ARCHIVE_PERSIST_TIP } from '../../../shared/tips'

interface SettingsViewProps {
  settings: AppSettings
  scanning: boolean
  onSave: (settings: AppSettings) => Promise<void>
  onRescan: () => Promise<void>
}

export function SettingsView({
  settings,
  scanning,
  onSave,
  onRescan
}: SettingsViewProps): React.JSX.Element {
  // Draft folders: parent remounts this view with a key when saved settings change.
  const [gamesFolder, setGamesFolder] = useState(settings.gamesFolder)
  const [coversFolder, setCoversFolder] = useState(settings.coversFolder)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [supportBusy, setSupportBusy] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

  useEffect(() => {
    void window.api
      .getAppInfo()
      .then(setAppInfo)
      .catch((err) => reportError('Failed to load app info', {}, err))
  }, [])

  const pickGames = async (): Promise<void> => {
    const path = await window.api.pickFolder()
    if (path) setGamesFolder(path)
  }

  const pickCovers = async (): Promise<void> => {
    const path = await window.api.pickFolder()
    if (path) setCoversFolder(path)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setMessage(null)
    try {
      await onSave({
        gamesFolder,
        coversFolder,
        legalAcceptedAt: settings.legalAcceptedAt
      })
      setMessage('Ajustes guardados. Biblioteca actualizada.')
    } catch (err) {
      reportError('Failed to save settings', {}, err)
      setMessage(err instanceof Error ? err.message : 'No se pudieron guardar los ajustes.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenLogs = async (): Promise<void> => {
    setSupportBusy(true)
    setMessage(null)
    try {
      const logsPath = await window.api.openLogsFolder()
      setMessage(`Logs: ${logsPath}`)
    } catch (err) {
      reportError('Failed to open logs folder', {}, err)
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir la carpeta de logs.')
    } finally {
      setSupportBusy(false)
    }
  }

  const handleCheckUpdates = async (): Promise<void> => {
    setSupportBusy(true)
    setMessage(null)
    try {
      const result = await window.api.checkForUpdates()
      setMessage(result.message ?? result.status)
    } catch (err) {
      reportError('Failed to check for updates', {}, err)
      setMessage(err instanceof Error ? err.message : 'No se pudo buscar actualizaciones.')
    } finally {
      setSupportBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <div className="dos-section-bar">Setup</div>
      <div className="space-y-5 p-4">
        <section className="space-y-2">
          <p className="dos-muted">Carpeta de juegos</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={gamesFolder}
              readOnly
              onClick={() => void pickGames()}
              placeholder="► Browse para elegir carpeta"
            />
            <Button type="button" variant="ghost" onClick={pickGames}>
              ► Browse
            </Button>
          </div>
          <p className="text-[16px] dos-muted">.exe .com .bat .zip .rar</p>
          <p className="text-[16px] text-[var(--dos-cyan)]">{ARCHIVE_PERSIST_TIP}</p>
        </section>

        <section className="space-y-2">
          <p className="dos-muted">Carpeta de portadas (opcional)</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={coversFolder}
              readOnly
              onClick={() => void pickCovers()}
              placeholder="Opcional — ► Browse"
            />
            <Button type="button" variant="ghost" onClick={pickCovers}>
              ► Browse
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button variant="yellow" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '► Save & scan'}
          </Button>
          <Button variant="ghost" onClick={onRescan} disabled={scanning || !gamesFolder.trim()}>
            ► Rescan
          </Button>
        </div>

        {message && <p className="border-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-3 py-2">{message}</p>}

        <div className="dos-section-bar -mx-4">Diagnostics</div>
        <section className="space-y-2 pt-1">
          {appInfo && (
            <p className="text-[16px] dos-muted">
              v{appInfo.version} · Electron {appInfo.electron} · {appInfo.platform}/{appInfo.arch}
              {' · '}
              canal {appInfo.distributionChannel}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="yellow" size="sm" onClick={() => setSupportOpen(true)} disabled={supportBusy}>
              ► Reportar problema
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenLogs} disabled={supportBusy}>
              ► Open logs
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCheckUpdates} disabled={supportBusy}>
              ► Check updates
            </Button>
          </div>
        </section>
      </div>
      {supportOpen && (
        <DosSupportDialog
          errorSummary="Reporte manual desde Ajustes (sin error de launch)."
          contextLabel="Manual"
          onClose={() => setSupportOpen(false)}
        />
      )}
    </div>
  )
}
