import { Button } from '@renderer/components/ui/button'
import type { UpdateCheckResult } from '../../../shared/types'
import { reportError } from '@renderer/lib/report-error'

interface UpdateBannerProps {
  result: UpdateCheckResult
  onDismiss: () => void
}

export function UpdateBanner({ result, onDismiss }: UpdateBannerProps): React.JSX.Element | null {
  if (result.status !== 'available') return null

  const openRelease = async (): Promise<void> => {
    try {
      await window.api.openReleasesPage()
    } catch (err) {
      reportError('Failed to open releases page', {}, err)
    }
  }

  const install = async (): Promise<void> => {
    try {
      const outcome = await window.api.downloadAndInstallUpdate()
      if (!outcome.ok) {
        reportError('Update install declined/failed', { message: outcome.message })
      }
    } catch (err) {
      reportError('Failed to download/install update', {}, err)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-3 py-2 text-[16px]">
      <span className="text-[var(--dos-yellow)]">
        Actualización disponible: v{result.latestVersion} (tenés v{result.currentVersion})
      </span>
      <Button variant="yellow" size="sm" onClick={() => void install()}>
        ► Instalar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void openRelease()}>
        ► Ver release
      </Button>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        ► Luego
      </Button>
    </div>
  )
}
