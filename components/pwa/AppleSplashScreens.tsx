import { APPLE_SPLASH_SCREENS } from '@/lib/pwa/apple-splash-screens'

/**
 * Écrans de démarrage iOS.
 *
 * Contrairement à Android, iOS ignore `background_color` et les icônes du
 * manifest au lancement : sans ces balises, une PWA ajoutée à l'écran d'accueil
 * démarre sur un écran blanc. Chaque modèle exige sa propre image, ciblée par
 * une média-query sur les dimensions CSS, la densité et l'orientation.
 *
 * Les images et la liste sont produites par `scripts/generate-pwa-assets.mjs`.
 */
export function AppleSplashScreens() {
  return (
    <>
      {APPLE_SPLASH_SCREENS.map(({ href, media }) => (
        <link key={href} rel="apple-touch-startup-image" href={href} media={media} />
      ))}
    </>
  )
}
