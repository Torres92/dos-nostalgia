import type { ReactNode } from 'react'

interface DosShellProps {
  children: ReactNode
  statusLeft?: string
  statusRight?: string
}

export function DosShell({ children, statusLeft, statusRight }: DosShellProps): React.JSX.Element {
  return (
    <div className="dos-shell">
      <div className="dos-window">{children}</div>
      <footer className="dos-statusbar">
        <span>
          <strong>ENTER</strong> jugar · <strong>↑↓</strong> navegar · <strong>F2</strong> ajustes
        </span>
        {statusLeft && (
          <span className="dos-muted max-w-[40%] truncate" title={statusLeft}>
            {statusLeft}
          </span>
        )}
        {statusRight && <span className="ml-auto shrink-0">{statusRight}</span>}
      </footer>
    </div>
  )
}
