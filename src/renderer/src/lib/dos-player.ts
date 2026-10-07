/** js-dos player bootstrap — kept separate from React for clearer debugging. */

export interface DosPlayerHandle {
  stop: () => Promise<void>
  save?: () => Promise<void>
}

interface FsNode {
  name: string
  size: number | null
  nodes: FsNode[] | null
}

/** Minimal Command Interface surface used for persisting setup changes. */
export interface DosCommandInterface {
  persist: (onlyChanges?: boolean) => Promise<Uint8Array | null>
  fsTree?: () => Promise<FsNode>
  fsReadFile?: (file: string) => Promise<Uint8Array>
  simulateKeyPress?: (...keyCodes: number[]) => void
  sendKeyEvent?: (keyCode: number, pressed: boolean) => void
}

export interface DosPlayerOptions {
  url?: string
  pathPrefix?: string
  theme?: string
  lang?: string
  autoStart?: boolean
  kiosk?: boolean
  noCloud?: boolean
  backend?: 'dosbox' | 'dosboxX'
  backendLocked?: boolean
  workerThread?: boolean
  offscreenCanvas?: boolean
  renderBackend?: 'webgl' | 'canvas'
  /** Keep native pixels; "4/3" etc. reintroduce Keen-style scroll shake. */
  renderAspect?: 'AsIs' | '1/1' | '5/4' | '4/3' | '16/9' | '16/10' | 'Fit'
  imageRendering?: 'pixelated' | 'smooth'
  onEvent?: (event: string, arg?: unknown) => void
}

declare global {
  interface Window {
    Dos?: (element: HTMLDivElement, options: DosPlayerOptions) => DosPlayerHandle
  }
}

let dosAssetsPromise: Promise<void> | null = null

export function loadDosAssets(): Promise<void> {
  if (window.Dos) return Promise.resolve()
  if (dosAssetsPromise) return dosAssetsPromise

  dosAssetsPromise = new Promise((resolve, reject) => {
    const cssId = 'js-dos-css'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = './js-dos/js-dos.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = './js-dos/js-dos.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el emulador js-dos.'))
    document.body.appendChild(script)
  })

  return dosAssetsPromise
}

export function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

/** DOSBox-X is required for Keen 4–6 (EGA ATR); plain dosbox panics after ready screen. */
export const DEFAULT_DOS_PLAYER_OPTIONS: Omit<DosPlayerOptions, 'url' | 'pathPrefix' | 'onEvent'> =
  {
    theme: 'dark',
    lang: 'en',
    autoStart: true,
    kiosk: true,
    noCloud: true,
    backend: 'dosboxX',
    backendLocked: true,
    workerThread: false,
    offscreenCanvas: false,
    renderBackend: 'canvas',
    renderAspect: 'AsIs',
    imageRendering: 'pixelated'
  }
