import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'
import { THIRD_PARTY_CREDITS } from '../../../shared/credits'
import { Button } from '@renderer/components/ui/button'
import { reportError } from '@renderer/lib/report-error'
import { BrandLogo } from '@renderer/components/BrandLogo'

export function AboutView(): React.JSX.Element {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void window.api
      .getAppInfo()
      .then(setAppInfo)
      .catch((err) => reportError('Failed to load app info (About)', {}, err))
  }, [])

  const openLicenses = async (): Promise<void> => {
    setMessage(null)
    try {
      const path = await window.api.openLicensesFolder()
      setMessage(`Licenses: ${path}`)
    } catch (err) {
      reportError('Failed to open licenses folder', {}, err)
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir la carpeta de licencias.')
    }
  }

  const openUrl = async (url: string): Promise<void> => {
    setMessage(null)
    try {
      await window.api.openExternal(url)
    } catch (err) {
      reportError('Failed to open external URL', { url }, err)
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir el enlace.')
    }
  }

  const checkUpdates = async (): Promise<void> => {
    setMessage(null)
    try {
      const result = await window.api.checkForUpdates()
      setMessage(
        `${result.message ?? result.status}` +
          (result.channel ? ` [${result.channel}]` : '')
      )
    } catch (err) {
      reportError('Failed to check for updates (About)', {}, err)
      setMessage(err instanceof Error ? err.message : 'No se pudo buscar actualizaciones.')
    }
  }

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <div className="dos-section-bar">About</div>
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <BrandLogo className="h-16 w-16 shrink-0" />
          <div>
            <p>
              DOS Nostalgia — launcher con emulación DOSBox-X (js-dos).
              {appInfo ? ` v${appInfo.version}` : ''}
              <span className="dos-cursor" />
            </p>
            <p className="mt-2 dos-muted">
              No incluye ROMs. Producto y componentes de emulación bajo GPLv2. Apuntá a tu propia
              carpeta de juegos (BYOG).
            </p>
            {appInfo && (
              <p className="mt-1 text-[16px] dos-muted">
                Canal de distribución: {appInfo.distributionChannel}
              </p>
            )}
          </div>
        </div>

        <div className="dos-section-bar -mx-4">Updates</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => void checkUpdates()}>
            ► Check updates
          </Button>
        </div>

        <div className="dos-section-bar -mx-4">Licenses (GPLv2)</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="yellow" size="sm" onClick={openLicenses}>
            ► Open licenses folder
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openUrl('https://www.gnu.org/licenses/old-licenses/gpl-2.0.html')}
          >
            ► GPL-2.0 web
          </Button>
        </div>
        <p className="dos-muted text-[16px]">
          Includes NOTICE.txt, THIRD_PARTY_NOTICES.txt, PRIVACY.txt, TERMS.txt, GPL-2.0.txt
        </p>
        {appInfo?.licensesPath && (
          <p className="break-all text-[16px] dos-muted">{appInfo.licensesPath}</p>
        )}

        <div className="dos-section-bar -mx-4">Credits</div>
        <ul className="dos-menu">
          {THIRD_PARTY_CREDITS.map((credit) => (
            <li key={credit.name}>
              <button
                type="button"
                className="dos-menu-item"
                onClick={() => openUrl(credit.url)}
              >
                <span className="dos-arrow">►</span>
                <span className="min-w-0 flex-1 truncate">
                  {credit.name} — {credit.role}
                </span>
                <span className="dos-badge">[{credit.license}]</span>
              </button>
            </li>
          ))}
        </ul>

        {message && (
          <p className="border-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-3 py-2">{message}</p>
        )}
      </div>
    </div>
  )
}
