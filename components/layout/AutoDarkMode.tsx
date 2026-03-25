'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/**
 * Sur mobile (≤ 767px) : force le mode clair et nettoie le localStorage
 * pour éviter le crash GPU iOS Safari (backdrop-filter + thème sombre).
 * Le ThemeToggle est déjà masqué sur mobile dans Header.tsx.
 *
 * Sur desktop : le thème par défaut est "light". L'utilisateur peut
 * basculer manuellement via le toggle dans le header.
 */
export function AutoDarkMode() {
  const { setTheme } = useTheme()

  useEffect(() => {
    // Sur mobile, forcer le mode clair et supprimer toute préférence dark
    if (window.innerWidth <= 767) {
      try { localStorage.removeItem('theme') } catch { /* ignore */ }
      setTheme('light')
      return
    }
    // Desktop : ne rien faire, le defaultTheme="light" du ThemeProvider
    // s'applique. L'utilisateur bascule manuellement via le toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
