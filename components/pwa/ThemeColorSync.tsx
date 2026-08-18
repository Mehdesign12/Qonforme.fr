'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/** Valeurs de `--background` dans `globals.css`. */
const THEME_COLORS = {
  light: '#F8FAFC',
  dark: '#0B1628',
} as const

/**
 * Aligne `<meta name="theme-color">` sur le thème réellement appliqué.
 *
 * En PWA plein écran, iOS et Android peignent la zone de la barre d'état avec
 * cette couleur. Une valeur figée laisserait une bande claire au-dessus d'une
 * app passée en sombre. `next-themes` étant piloté par `localStorage` et non par
 * `prefers-color-scheme` (`enableSystem={false}`), une balise `media` ne suffit pas.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    // `resolvedTheme` est indéfini au premier rendu : on attend sa résolution
    // plutôt que d'écrire une couleur par défaut qui provoquerait un clignotement.
    if (!resolvedTheme) return

    const color = resolvedTheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

    if (meta) meta.content = color
  }, [resolvedTheme])

  return null
}
