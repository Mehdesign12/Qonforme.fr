'use client'

import { useEffect, useState } from 'react'
import { isIOS, isSafari, isStandalone } from './client'

/**
 * Signale la fin de l'hydratation.
 *
 * Toute décision de rendu basée sur `window` doit passer par ce garde, sinon le
 * balisage serveur diffère du premier rendu client (règle CLAUDE.md).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

/**
 * `true` quand l'app tourne en plein écran depuis l'écran d'accueil.
 * Reste `false` pendant le rendu serveur et le premier rendu client.
 */
export function useStandalone(): boolean {
  const mounted = useMounted()
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const update = () => setStandalone(isStandalone())
    update()

    // Le mode d'affichage change si l'utilisateur installe l'app sans recharger.
    const media = window.matchMedia('(display-mode: standalone)')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return mounted && standalone
}

/** État réseau. Optimiste avant hydratation : on suppose la connexion active. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    setOnline(navigator.onLine)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

export type Platform = {
  /** Hydratation terminée — les champs ci-dessous n'ont de sens que si `true`. */
  ready: boolean
  isIOS: boolean
  isSafari: boolean
  isStandalone: boolean
}

/** Regroupe les détections de plateforme en une seule passe post-hydratation. */
export function usePlatform(): Platform {
  const mounted = useMounted()
  const [platform, setPlatform] = useState<Omit<Platform, 'ready'>>({
    isIOS: false,
    isSafari: false,
    isStandalone: false,
  })

  useEffect(() => {
    setPlatform({
      isIOS: isIOS(),
      isSafari: isSafari(),
      isStandalone: isStandalone(),
    })
  }, [])

  return { ready: mounted, ...platform }
}
