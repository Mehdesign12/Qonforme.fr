/**
 * Liens de l'écran de démarrage, pour l'application et la démo. Module pur
 * (utilisable par les pages serveur comme par le composant client).
 */
export type StartMode = "app" | "demo"

/**
 * Tableau de bord depuis l'écran de démarrage. `?depuis=demarrer` : le tableau
 * de bord ne renvoie pas vers l'écran de démarrage, même si l'enregistrement
 * des premiers pas « vus » a échoué.
 */
export function dashboardHref(mode: StartMode): string {
  return mode === "demo" ? "/demo" : "/dashboard?depuis=demarrer"
}

/** Chemin de l'application, préfixé par /demo en démo. */
export function startHref(mode: StartMode, path: string): string {
  return mode === "demo" ? `/demo${path}` : path
}
