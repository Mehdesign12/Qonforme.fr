'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/**
 * Auto-active le mode sombre la nuit (18h–5h) si l'utilisateur
 * n'a pas encore défini de préférence manuelle.
 */
export function AutoDarkMode() {
  const { setTheme } = useTheme()

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem('theme')
    } catch { /* ignore */ }

    const hour = new Date().getHours()
    console.log(`[AutoDarkMode] mount  stored=${stored ?? 'null'}  hour=${hour}`)

    if (stored) {
      console.log('[AutoDarkMode] choix manuel détecté → pas de modification')
      return
    }

    if (hour >= 18 || hour < 5) {
      console.log('[AutoDarkMode] nuit détectée → setTheme(dark)')
      setTheme('dark')
    } else {
      console.log('[AutoDarkMode] journée → thème inchangé')
    }
    // Dépendance volontairement vide : cet effet ne doit s'exécuter qu'une seule
    // fois au montage. Lister `setTheme` provoquerait une boucle car next-themes
    // v0.4.x recrée la référence de setTheme à chaque changement de thème.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
