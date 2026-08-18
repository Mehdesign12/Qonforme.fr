'use client'

import { useEffect } from 'react'
import { isStandalone } from '@/lib/pwa/client'

/**
 * Pose `data-standalone="true"` sur `<html>` quand l'app tourne en plein écran.
 *
 * On ne se contente pas du média `display-mode: standalone` en CSS : iOS ne le
 * supporte que depuis la 16.4, alors que `navigator.standalone` fonctionne
 * depuis toujours. Passer par le JS donne un sélecteur unique et fiable,
 * `html[data-standalone="true"]`, valable sur toutes les versions.
 */
export function StandaloneFlag() {
  useEffect(() => {
    const update = () => {
      document.documentElement.dataset.standalone = String(isStandalone())
    }

    update()

    // L'installation peut survenir sans rechargement de la page.
    const media = window.matchMedia('(display-mode: standalone)')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return null
}
