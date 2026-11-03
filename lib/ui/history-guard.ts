/**
 * Bouton « Retour » du navigateur (et balayage depuis le bord gauche sur
 * iPhone) pendant qu'un formulaire a des modifications non enregistrées.
 *
 * Un retour ne s'annule pas : il a déjà eu lieu quand le navigateur prévient.
 * Dès qu'un formulaire devient « modifié », on marque donc l'entrée en cours
 * (« base ») et on ajoute par-dessus une entrée identique (« top », même
 * adresse, même état Next.js). Un retour quitte l'entrée « top » pour
 * l'entrée « base » : la page ne change pas, rien n'est perdu, et la fenêtre
 * « … n'est pas enregistré » s'ouvre.
 *   - Rester : on remet l'entrée « top » (`rearmBack`).
 *   - Quitter : on recule pour de bon (`leaveBack`).
 * Une entrée marquée sur laquelle on retombe alors que plus rien n'est modifié
 * (après un enregistrement) est sautée toute seule : jamais deux appuis sur
 * Retour pour quitter une page.
 *
 * Les entrées sont ajoutées par `history.pushState` sans adresse : Next.js
 * (routeur de l'application) y recopie son propre état, et son traitement du
 * retour retrouve la même page, sans rechargement.
 */

export const HISTORY_MARK = "__qUnsaved"

export type PopAction = "none" | "consume" | "hold" | "back" | "back-skip"

type Marked = { [HISTORY_MARK]?: "base" | "top" } | null | undefined

/**
 * Que faire d'un retour (évènement popstate) qui vient d'arriver sur `state` ?
 * - consume : ce retour est celui qu'on a lancé pour sauter une entrée ;
 * - hold : retour depuis l'entrée « top » avec une saisie en cours → fenêtre ;
 * - back : on est retombé sur l'entrée « base » sans saisie → on recule encore ;
 * - back-skip : on est retombé sur une entrée « top » sans saisie (en revenant
 *   d'une autre page) → on recule sur sa « base », qui est la même page.
 */
export function popAction(state: unknown, { armed, skipping }: { armed: boolean; skipping: boolean }): PopAction {
  if (skipping) return "consume"
  const mark = (state as Marked)?.[HISTORY_MARK]
  if (mark === "base") return armed ? "hold" : "back"
  if (mark === "top") return armed ? "none" : "back-skip"
  return "none"
}

interface Holder { open: () => void }

const holders = new Set<Holder>()
let skipping = false
let leaving = false
let installed = false

function currentMark(): string | undefined {
  return (window.history.state as Marked)?.[HISTORY_MARK]
}

function onPop(event: PopStateEvent) {
  const action = popAction(event.state, { armed: holders.size > 0 && !leaving, skipping })
  leaving = false
  if (action === "consume") { skipping = false; return }
  if (action === "hold") { holders.values().next().value?.open(); return }
  if (action === "back") { window.history.back(); return }
  if (action === "back-skip") { skipping = true; window.history.back() }
}

function install() {
  if (installed || typeof window === "undefined") return
  installed = true
  window.addEventListener("popstate", onPop)
}

/** Ajoute l'entrée « top » si elle n'est pas déjà celle en cours. */
function arm() {
  if (currentMark() === "top") return
  window.history.replaceState({ [HISTORY_MARK]: "base" }, "")
  window.history.pushState({ [HISTORY_MARK]: "top" }, "")
}

/**
 * Un formulaire a des modifications : un retour ouvrira `open()`. Rend la
 * fonction à appeler quand il n'en a plus (ou se démonte).
 */
export function holdBack(holder: Holder): () => void {
  if (typeof window === "undefined") return () => {}
  install()
  holders.add(holder)
  arm()
  return () => { holders.delete(holder) }
}

/** « Rester sur la page » après un retour retenu : la garde reprend. */
export function rearmBack() {
  if (typeof window === "undefined" || holders.size === 0) return
  arm()
}

/** « Quitter sans enregistrer » après un retour retenu : on recule pour de bon. */
export function leaveBack() {
  if (typeof window === "undefined") return
  leaving = true
  window.history.back()
}

/** Pour les tests. */
export function resetHistoryGuard() {
  holders.clear()
  skipping = false
  leaving = false
}
