import type { LogLevel } from '../../../shared/types'

/** Send an error to the main-process log file (and console). */
export function reportError(
  message: string,
  context?: Record<string, unknown>,
  cause?: unknown
): void {
  const details: Record<string, unknown> = { ...(context ?? {}) }
  if (cause instanceof Error) {
    details.causeName = cause.name
    details.causeMessage = cause.message
    details.causeStack = cause.stack
  } else if (cause !== undefined) {
    details.cause = String(cause)
  }

  console.error(message, details)
  void window.api?.log('error', message, details)
}

export function reportLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  if (level === 'error') {
    console.error(message, context)
  } else if (level === 'warn') {
    console.warn(message, context)
  } else {
    console.log(message, context)
  }
  void window.api?.log(level, message, context)
}
