/**
 * Dernière méthode de connexion utilisée sur cet appareil : rappelée par une
 * pastille sur la page de connexion. Stockage local seulement (aucune donnée
 * envoyée, aucun cookie) ; relu sans confiance, toute autre valeur est ignorée.
 */
export type AuthMethod = "google" | "email"

const KEY = "qonforme:last-auth"

export function readLastAuthMethod(): AuthMethod | null {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === "google" || v === "email" ? v : null
  } catch {
    return null
  }
}

export function rememberAuthMethod(method: AuthMethod | null): void {
  try {
    if (method) window.localStorage.setItem(KEY, method)
    else window.localStorage.removeItem(KEY)
  } catch {
    /* navigation privée ou stockage bloqué : le rappel est facultatif */
  }
}
