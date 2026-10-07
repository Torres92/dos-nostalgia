import { useEffect, useId, useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { reportError } from '@renderer/lib/report-error'

interface DosSupportDialogProps {
  /** Short human-readable error shown in the modal. */
  errorSummary: string
  /** Label for logs / GitHub title (e.g. Launch error). */
  contextLabel?: string
  onClose: () => void
}

/**
 * Friendly support modal: shows the error, optional comment, one Enviar action.
 * Today: copies full diagnostics + opens GitHub Issues when homepage is a real repo.
 */
export function DosSupportDialog({
  errorSummary,
  contextLabel = 'Soporte',
  onClose
}: DosSupportDialogProps): React.JSX.Element {
  const titleId = useId()
  const errorId = useId()
  const commentId = useId()
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [busy, onClose])

  const handleSend = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      const result = await window.api.submitSupportReport({
        errorSummary,
        userComment: comment,
        contextLabel
      })
      setStatus(result.message)
    } catch (err) {
      reportError('Failed to submit support report', { contextLabel }, err)
      setStatus(err instanceof Error ? err.message : 'No se pudo preparar el reporte.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--dos-black)]/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="w-full max-w-lg border-4 border-double border-[var(--dos-white)] bg-[var(--dos-blue)] shadow-[8px_8px_0_var(--dos-shadow)]">
        <div id={titleId} className="dos-section-bar">
          REPORTAR PROBLEMA
        </div>
        <div className="space-y-3 p-4">
          <p className="text-[16px] dos-muted">
            Revisá el error, agregá un comentario si querés, y pulsá Enviar.
          </p>

          <label htmlFor={errorId} className="block text-[16px] text-[var(--dos-cyan)]">
            Error
          </label>
          <textarea
            id={errorId}
            readOnly
            value={errorSummary}
            rows={3}
            className="w-full resize-y border-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-2 py-1 text-[16px] text-[var(--dos-yellow)] outline-none"
          />

          <label htmlFor={commentId} className="block text-[16px] text-[var(--dos-cyan)]">
            Tu comentario (opcional)
          </label>
          <textarea
            id={commentId}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="¿Qué estabas haciendo? ¿Se puede reproducir?"
            autoFocus
            disabled={busy}
            className="w-full resize-y border-2 border-[var(--dos-white)] bg-[var(--dos-black)] px-2 py-1 text-[16px] text-[var(--dos-white)] outline-none placeholder:text-[var(--dos-gray)]"
          />

          {status && <p className="text-[15px] text-[var(--dos-yellow)]">{status}</p>}

          <p className="text-[15px] dos-muted">
            Enviar copia el diagnóstico y abre GitHub Issues (cuando el repo esté configurado). Esc =
            cerrar.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="yellow" disabled={busy} onClick={() => void handleSend()}>
              {busy ? 'Preparando…' : '► Enviar'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              {status ? '► Cerrar' : '► Cancelar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
