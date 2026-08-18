import { isNativeApp } from './platform'

/**
 * Ouvre une URL hors de l'interface de l'app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi ne jamais laisser ces URL dans la WKWebView
 * ─────────────────────────────────────────────────────────────────────────────
 * Stripe Checkout et les redirections d'authentification ne doivent pas
 * s'exécuter dans la webview de l'app :
 *   - Apple refuse les tunnels de paiement présentés comme faisant partie de
 *     l'app (règle 3.1) ; SFSafariViewController est le conteneur attendu ;
 *   - la webview ne partage pas les cookies de Safari : l'utilisateur devrait
 *     ressaisir sa carte, et 3-D Secure échouerait sur certaines banques ;
 *   - au retour, l'app se retrouverait bloquée sur une page Stripe sans
 *     moyen de revenir en arrière.
 *
 * `@capacitor/browser` ouvre SFSafariViewController par-dessus l'app : le
 * contexte Safari est conservé et l'utilisateur revient d'un geste.
 */

/** Ouvre une URL externe (paiement, aide, lien légal) dans le navigateur système. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url, presentationStyle: 'popover' })
      return
    } catch {
      // Repli sur la navigation classique si le plugin n'a pas pu s'ouvrir.
    }
  }

  if (typeof window === 'undefined') return

  // `noopener` empêche la page ouverte d'accéder à `window.opener`.
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Ferme la vue navigateur ouverte par `openExternalUrl`.
 *
 * À appeler quand l'app détecte le retour d'un paiement via deep link — sinon
 * la vue Stripe resterait affichée par-dessus le tableau de bord mis à jour.
 */
export async function closeExternalBrowser(): Promise<void> {
  if (!isNativeApp()) return

  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.close()
  } catch {
    // Aucune vue ouverte : rien à faire.
  }
}
