import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import { DosSupportDialog } from '@renderer/components/DosSupportDialog'
import { reportError } from '@renderer/lib/report-error'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
  supportMessage: string | null
  supportOpen: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
    supportMessage: null,
    supportOpen: false
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      message: error.message || 'Error inesperado en la interfaz.'
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError('React render crash', { componentStack: info.componentStack }, error)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleOpenLogs = async (): Promise<void> => {
    try {
      await window.api.openLogsFolder()
      this.setState({ supportMessage: 'Carpeta de logs abierta.' })
    } catch (err) {
      this.setState({
        supportMessage: err instanceof Error ? err.message : 'No se pudo abrir la carpeta de logs.'
      })
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="dos-shell">
        <div className="dos-window items-center justify-center gap-4 p-6 text-center">
          <div className="dos-section-bar w-full max-w-lg text-left">Fatal error</div>
          <p className="dos-danger max-w-lg">{this.state.message}</p>
          <p className="dos-muted max-w-lg text-[16px]">
            Podés reportar el problema con un clic; el diagnóstico se copia solo.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="yellow" onClick={this.handleReload}>
              ► Reload
            </Button>
            <Button variant="ghost" onClick={() => this.setState({ supportOpen: true })}>
              ► Reportar
            </Button>
            <Button variant="ghost" onClick={this.handleOpenLogs}>
              ► Open logs
            </Button>
          </div>
          {this.state.supportMessage && (
            <p className="dos-muted text-[16px]">{this.state.supportMessage}</p>
          )}
        </div>
        {this.state.supportOpen && (
          <DosSupportDialog
            errorSummary={this.state.message}
            contextLabel="Fatal UI"
            onClose={() => this.setState({ supportOpen: false })}
          />
        )}
      </div>
    )
  }
}
