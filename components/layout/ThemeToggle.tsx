'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Évite le flash côté serveur
  if (!mounted) return <div className="w-8 h-8" />

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => {
        const next = isDark ? 'light' : 'dark'
        setTheme(next)
        try { localStorage.setItem('theme', next) } catch { /* ignore */ }
      }}
      className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
      style={{ color: isDark ? '#94A3B8' : '#94A3B8' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#E2E8F0' : '#475569' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      {isDark
        ? <Sun  className="w-[17px] h-[17px]" />
        : <Moon className="w-[17px] h-[17px]" />
      }
    </button>
  )
}
