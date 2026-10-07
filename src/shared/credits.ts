/** Allowed http(s) destinations for shell.openExternal from the renderer. */
export const ALLOWED_EXTERNAL_URLS = [
  'https://js-dos.com',
  'https://github.com/caiiiycuk/js-dos',
  'https://github.com/js-dos/emulators',
  'https://www.dosbox.com',
  'https://dosbox-x.com',
  'https://github.com/joncampbell123/dosbox-x',
  'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html',
  'https://www.electronjs.org'
] as const

export type AllowedExternalUrl = (typeof ALLOWED_EXTERNAL_URLS)[number]

export interface ThirdPartyCredit {
  name: string
  role: string
  license: string
  url: AllowedExternalUrl
}

export const THIRD_PARTY_CREDITS: ThirdPartyCredit[] = [
  {
    name: 'js-dos',
    role: 'Reproductor DOS embebido (UI + runtime)',
    license: 'GPL-2.0',
    url: 'https://js-dos.com'
  },
  {
    name: 'emulators',
    role: 'Backends WASM DOSBox / DOSBox-X',
    license: 'GPL-2.0',
    url: 'https://github.com/js-dos/emulators'
  },
  {
    name: 'DOSBox',
    role: 'Emulador DOS original (base GPL)',
    license: 'GPL-2.0',
    url: 'https://www.dosbox.com'
  },
  {
    name: 'DOSBox-X',
    role: 'Backend usado por esta app (EGA / compatibilidad)',
    license: 'GPL-2.0',
    url: 'https://dosbox-x.com'
  }
]
