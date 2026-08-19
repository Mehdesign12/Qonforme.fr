/**
 * Onboarding d'accueil natif — carrousel montré une seule fois par appareil,
 * avant même l'écran de connexion.
 *
 * À ne pas confondre avec l'amorçage de notifications (`push-priming-seen`
 * dans `lib/native/push.ts`) : celui-ci cible les clients existants, déjà
 * connectés, pour préparer la popup système iOS. Celui-ci cible quelqu'un qui
 * découvre l'app depuis l'App Store, avant toute authentification — voir
 * `components/native/AppOnboardingCarousel.tsx`.
 *
 * Même convention Preferences que le reste de `lib/native/` : ces fonctions
 * ne sont appelées que depuis un contexte déjà garanti natif (l'appelant
 * teste `isNativeApp()` en amont), donc pas de garde redondante ici.
 */

const ONBOARDING_SEEN_KEY = 'qonforme.app-onboarding-seen'

/** Le carrousel d'accueil a-t-il déjà été montré (terminé ou passé) sur cet appareil ? */
export async function hasSeenAppOnboarding(): Promise<boolean> {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: ONBOARDING_SEEN_KEY })
    return value === '1'
  } catch {
    // En cas de doute, on préfère le remontrer plutôt que priver quelqu'un
    // de sa première impression de l'app — même arbitrage que le push priming.
    return false
  }
}

/** Marque le carrousel comme vu — qu'il ait été terminé ou passé ("Passer"). */
export async function markAppOnboardingSeen(): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: ONBOARDING_SEEN_KEY, value: '1' })
  } catch {
    // Stockage indisponible : le carrousel pourra réapparaître au prochain lancement, sans gravité.
  }
}
