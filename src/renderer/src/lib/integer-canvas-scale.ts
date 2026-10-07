/** Integer CSS scale for js-dos without per-frame layout thrashing. */

function snapCanvas(canvas: HTMLCanvasElement, parent: HTMLElement): void {
  const frameW = canvas.width
  const frameH = canvas.height
  if (frameW < 1 || frameH < 1) return

  const parentW = parent.clientWidth
  const parentH = parent.clientHeight
  if (parentW < 1 || parentH < 1) return

  // Integer CSS scale only (no fractional DPR widths — those shimmer when the map scrolls).
  const scale = Math.max(1, Math.floor(Math.min(parentW / frameW, parentH / frameH)))
  const next = {
    position: 'absolute',
    width: `${frameW}px`,
    height: `${frameH}px`,
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center center',
    imageRendering: 'pixelated'
  }

  if (canvas.style.position !== next.position) canvas.style.position = next.position
  if (canvas.style.width !== next.width) canvas.style.width = next.width
  if (canvas.style.height !== next.height) canvas.style.height = next.height
  if (canvas.style.left !== next.left) canvas.style.left = next.left
  if (canvas.style.top !== next.top) canvas.style.top = next.top
  if (canvas.style.transform !== next.transform) canvas.style.transform = next.transform
  if (canvas.style.transformOrigin !== next.transformOrigin) {
    canvas.style.transformOrigin = next.transformOrigin
  }
  if (canvas.style.imageRendering !== next.imageRendering) {
    canvas.style.imageRendering = next.imageRendering
  }
}

/**
 * Re-apply integer scale only when the host or canvas buffer size changes.
 * A per-frame loop + getBoundingClientRect forces layout and hitch exactly when
 * Keen redraws newly scrolled map tiles.
 */
export function attachIntegerCanvasScale(host: HTMLElement): () => void {
  let rafId = 0
  let canvas: HTMLCanvasElement | null = null

  const schedule = (): void => {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      if (!canvas || !canvas.isConnected) {
        canvas = host.querySelector('canvas')
      }
      if (canvas) snapCanvas(canvas, host)
    })
  }

  host.style.position = host.style.position || 'relative'
  host.style.overflow = 'hidden'

  const resizeObserver = new ResizeObserver(schedule)
  resizeObserver.observe(host)

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        canvas = host.querySelector('canvas')
        if (canvas) resizeObserver.observe(canvas)
        schedule()
        return
      }
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLCanvasElement) {
        schedule()
      }
    }
  })
  mutationObserver.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['width', 'height', 'style']
  })

  window.addEventListener('resize', schedule)
  schedule()

  return () => {
    cancelAnimationFrame(rafId)
    resizeObserver.disconnect()
    mutationObserver.disconnect()
    window.removeEventListener('resize', schedule)
  }
}
