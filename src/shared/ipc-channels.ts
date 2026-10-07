/** IPC channel names — single source of truth for main + preload. */
export const IpcChannels = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  dialogPickFolder: 'dialog:pick-folder',
  gamesScan: 'games:scan',
  gamesBuildBundle: 'games:build-bundle',
  gamesListFolder: 'games:list-folder',
  gamesApplyPersisted: 'games:apply-persisted',
  gamesWriteFiles: 'games:write-files',
  appGetInfo: 'app:get-info',
  logWrite: 'log:write',
  diagnosticsGet: 'diagnostics:get',
  diagnosticsOpenLogs: 'diagnostics:open-logs',
  diagnosticsCopyReport: 'diagnostics:copy-report',
  diagnosticsSubmitSupport: 'diagnostics:submit-support',
  licensesOpenFolder: 'licenses:open-folder',
  shellOpenExternal: 'shell:open-external',
  updatesCheck: 'updates:check',
  updatesDownloadInstall: 'updates:download-install',
  updatesOpenRelease: 'updates:open-release',
  windowToggleFullscreen: 'window:toggle-fullscreen',
  windowSetFullscreen: 'window:set-fullscreen',
  windowIsFullscreen: 'window:is-fullscreen',
  windowFullscreenChanged: 'window:fullscreen-changed'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
