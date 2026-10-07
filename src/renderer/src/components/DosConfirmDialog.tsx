import { useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'

interface DosConfirmDialogProps {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Modal confirm matching the DOS shell look (double border, section bar). */
export function DosConfirmDialog({
  title = 'CONFIRMAR',
  message,
  confirmLabel = '► Salir',
  cancelLabel = '► Cancelar',
  onConfirm,
  onCancel
}: DosConfirmDialogProps): React.JSX.Element {
  useEffect(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onConfirm()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel, onConfirm])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--dos-black)]/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dos-confirm-title"
      aria-describedby="dos-confirm-message"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md border-4 border-double border-[var(--dos-white)] bg-[var(--dos-blue)] shadow-[8px_8px_0_var(--dos-shadow)]">
        <div id="dos-confirm-title" className="dos-section-bar">
          {title}
        </div>
        <div className="space-y-4 p-4">
          <p id="dos-confirm-message" className="text-[18px] text-[var(--dos-yellow)]">
            {message}
          </p>
          <p className="text-[15px] dos-muted">Enter = aceptar · Esc = cancelar</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="yellow" autoFocus onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
