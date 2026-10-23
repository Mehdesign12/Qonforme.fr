/**
 * Glisser vers le bas pour fermer une feuille du bas (téléphone).
 *
 * Le geste démarre sur la barre grise de la feuille (`[data-sheet-grip]`) ou
 * dans le haut de la feuille (titre, en-tête), jamais sur un bouton, un lien
 * ou un champ. La feuille suit le doigt (transformation seule : ni `will-change`
 * ni flou, règle iOS de CLAUDE.md) ; au relâchement, elle se ferme si on l'a
 * assez tirée ou lancée vers le bas, sinon elle revient. Une feuille qui n'est
 * pas collée au bas de l'écran (carte centrée sur ordinateur) n'est pas touchée.
 *
 * `onDismiss` fait la fermeture que l'écran fait déjà (même garde-fous : « Passer
 * au tableau de bord » de l'inscription enregistre les saisies, un enregistrement
 * en cours empêche la fermeture). Si la feuille reste ouverte, elle revient à sa place.
 */

/** Hauteur du haut de la feuille d'où le geste peut partir, en pixels. */
export const TOP_ZONE = 72
/** Mouvement minimal avant de prendre le geste pour un glissement, en pixels. */
export const MOVE_SLOP = 6
/** Distance tirée qui ferme : 120 px, ou 30 % de la hauteur d'une petite feuille. */
export const DISMISS_DISTANCE = 120
export const DISMISS_RATIO = 0.3
/** Geste rapide qui ferme même court : vitesse (px/ms) et distance minimales. */
export const FLICK_VELOCITY = 0.5
export const FLICK_MIN = 40

const SETTLE_MS = 180

/** La feuille se ferme-t-elle ? `dy` : distance tirée vers le bas, `velocity` : px/ms au relâchement. */
export function shouldDismiss(dy: number, height: number, velocity: number): boolean {
  if (dy <= 0) return false
  if (velocity >= FLICK_VELOCITY && dy >= FLICK_MIN) return true
  return dy >= Math.min(DISMISS_DISTANCE, height * DISMISS_RATIO)
}

/** Vitesse (px/ms) sur les derniers 100 ms du geste. */
export function releaseVelocity(samples: { y: number; t: number }[]): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  const first = samples.find((s) => last.t - s.t <= 100) ?? samples[0]
  const dt = last.t - first.t
  return dt > 0 ? (last.y - first.y) / dt : 0
}

const INTERACTIVE = 'button, a, input, textarea, select, label, [role="button"], [role="option"], [contenteditable="true"]'

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Branche le geste sur la feuille `panel` ; rend la fonction qui le retire. */
export function attachSheetDrag(panel: HTMLElement, onDismiss: () => void): () => void {
  let tracking = false
  let dragging = false
  let startY = 0
  let dy = 0
  let samples: { y: number; t: number }[] = []
  const timers: ReturnType<typeof setTimeout>[] = []

  const dockedAtBottom = () => panel.getBoundingClientRect().bottom >= window.innerHeight - 2

  const springBack = () => {
    if (reducedMotion()) {
      panel.style.transition = ""
      panel.style.transform = ""
      return
    }
    panel.style.transition = `transform ${SETTLE_MS}ms ease-out`
    panel.style.transform = ""
    timers.push(setTimeout(() => { panel.style.transition = "" }, SETTLE_MS + 20))
  }

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const target = e.target instanceof Element ? e.target : null
    const onGrip = !!target?.closest("[data-sheet-grip]")
    if (!onGrip) {
      if (touch.clientY - panel.getBoundingClientRect().top > TOP_ZONE) return
      if (target?.closest(INTERACTIVE)) return
    }
    if (!dockedAtBottom()) return
    tracking = true
    dragging = false
    startY = touch.clientY
    dy = 0
    samples = [{ y: startY, t: performance.now() }]
  }

  const onMove = (e: TouchEvent) => {
    if (!tracking) return
    const y = e.touches[0]?.clientY
    if (y === undefined) return
    dy = y - startY
    if (!dragging) {
      if (dy < -MOVE_SLOP) { tracking = false; return }
      if (dy <= MOVE_SLOP) return
      dragging = true
      panel.style.transition = "none"
    }
    if (e.cancelable) e.preventDefault()
    samples.push({ y, t: performance.now() })
    if (samples.length > 8) samples.shift()
    panel.style.transform = `translateY(${Math.max(0, dy)}px)`
  }

  const onEnd = () => {
    if (!tracking) return
    tracking = false
    if (!dragging) return
    dragging = false
    const height = panel.getBoundingClientRect().height
    if (!shouldDismiss(dy, height, releaseVelocity(samples))) {
      springBack()
      return
    }
    if (reducedMotion()) {
      onDismiss()
    } else {
      panel.style.transition = `transform ${SETTLE_MS}ms ease-out`
      panel.style.transform = "translateY(100%)"
      timers.push(setTimeout(onDismiss, SETTLE_MS - 10))
    }
    // La fermeture refusée (enregistrement en cours…) : la feuille revient à sa place
    timers.push(setTimeout(() => { if (panel.isConnected) springBack() }, 600))
  }

  const onCancel = () => {
    if (!tracking) return
    tracking = false
    if (dragging) { dragging = false; springBack() }
  }

  panel.addEventListener("touchstart", onStart, { passive: true })
  panel.addEventListener("touchmove", onMove, { passive: false })
  panel.addEventListener("touchend", onEnd)
  panel.addEventListener("touchcancel", onCancel)
  return () => {
    panel.removeEventListener("touchstart", onStart)
    panel.removeEventListener("touchmove", onMove)
    panel.removeEventListener("touchend", onEnd)
    panel.removeEventListener("touchcancel", onCancel)
    timers.forEach(clearTimeout)
  }
}

/** Fermeture par défaut : la touche Échap, que chaque fenêtre sait déjà traiter. */
export function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
}
