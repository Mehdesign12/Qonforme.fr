/**
 * Premiers pas « vus » : marqueur posé à l'affichage de la fenêtre de
 * bienvenue ou des tuiles « Pour commencer » d'un compte neuf.
 *
 * 1. localStorage immédiat (filet de sécurité si l'API échoue) ;
 * 2. base via POST /api/onboarding/seen (source de vérité durable),
 *    4 tentatives avec attente croissante (1 s, 2 s, 4 s, 8 s), seulement
 *    sur 404 (entreprise pas encore créée) ou erreur réseau.
 */
export const ONBOARDING_SEEN_KEY = "qonforme_onboarding_seen"

export function hasSeenOnboardingLocally(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === "1"
  } catch {
    // localStorage indisponible (navigation privée, etc.)
    return false
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1")
  } catch {
    // navigation privée, etc.
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch("/api/onboarding/seen", { method: "POST" })
      if (res.ok) return
      // 404 = entreprise pas encore créée, on retente ; autre erreur (401, 500) : inutile
      if (res.status !== 404) return
    } catch {
      // erreur réseau : on retente
    }
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
  }
}
