/** Distribution + update check types (Steam vs direct installer). */

export type DistributionChannel = 'steam' | 'direct'

export type UpdateCheckStatus =
  | 'steam-managed'
  | 'skipped-dev'
  | 'up-to-date'
  | 'available'
  | 'unavailable'
  | 'error'

export interface UpdateCheckResult {
  status: UpdateCheckStatus
  channel: DistributionChannel
  currentVersion: string
  /** Newer version from feed, when status === 'available'. */
  latestVersion?: string
  /** Release / download page when known. */
  releaseUrl?: string
  message?: string
}
