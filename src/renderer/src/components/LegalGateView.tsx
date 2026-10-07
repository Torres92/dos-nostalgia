import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { reportError } from '@renderer/lib/report-error'
import { BrandLogo } from '@renderer/components/BrandLogo'

interface LegalGateViewProps {
  onAccept: () => void | Promise<void>
}

export function LegalGateView({ onAccept }: LegalGateViewProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const openLicenses = async (): Promise<void> => {
    setMessage(null)
    try {
      const path = await window.api.openLicensesFolder()
      setMessage(`Licenses: ${path}`)
    } catch (err) {
      reportError('Failed to open licenses folder (legal gate)', {}, err)
      setMessage(err instanceof Error ? err.message : 'No se pudo abrir la carpeta de licencias.')
    }
  }

  const handleAccept = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      await onAccept()
    } catch (err) {
      reportError('Failed to accept legal terms', {}, err)
      setMessage(err instanceof Error ? err.message : 'No se pudo guardar la aceptación.')
      setBusy(false)
    }
  }

  return (
    <div className="dos-shell !p-2">
      <div className="dos-window">
        <div className="dos-titlebar">
          <BrandLogo className="h-6 w-6 shrink-0" />
          <span className="dos-titlebar__brand">DOS Nostalgia</span>
          <span className="dos-titlebar__sep">│</span>
          <span className="text-[var(--dos-yellow)]">LEGAL.TXT</span>
        </div>
        <main className="dos-panel-body flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center animate-fade-in">
          <BrandLogo className="h-28 w-28" />
          <div className="dos-section-bar w-full max-w-xl text-left">Before you continue</div>
          <div className="max-w-xl space-y-3 text-left text-[var(--dos-white)]">
            <p>
              DOS Nostalgia is a BYOG launcher: it does <strong>not</strong> include commercial game
              ROMs. You must only add games you have the legal right to use.
            </p>
            <p className="dos-muted text-[16px]">
              The software is GPL-2.0. Privacy and terms ship in the licenses folder (PRIVACY.txt,
              TERMS.txt, NOTICE.txt).
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="ghost" onClick={openLicenses} disabled={busy}>
              ► Open licenses
            </Button>
            <Button variant="yellow" size="lg" onClick={handleAccept} disabled={busy}>
              ► I agree — continue
            </Button>
          </div>
          {message && (
            <p className="max-w-xl border-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-3 py-2 text-[16px]">
              {message}
            </p>
          )}
        </main>
        <footer className="dos-statusbar">
          <span>Accept TERMS + PRIVACY to use the library</span>
        </footer>
      </div>
    </div>
  )
}
