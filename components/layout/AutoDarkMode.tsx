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
    try {
      const stored = localStorage.getItem('theme')
      if (stored) return // Respecte le choix manuel
    } catch { /* ignore */ }

    const hour = new Date().getHours()
    if (hour >= 18 || hour < 5) {
      setTheme('dark')
    }
  }, [setTheme])

  return null
}
