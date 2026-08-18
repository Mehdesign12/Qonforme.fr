'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Enregistre le service worker et propose la mise à jour quand une nouvelle
 * version est prête.
 *
 * Sans ce composant, `public/sw.js` ne serait jamais activé : Next.js sert le
 * fichier mais n'enregistre rien de lui-même.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // En développement, le cache masquerait les modifications en cours d'édition.
    // On désenregistre au passage tout worker laissé par un build de production
    // testé en local, sinon il continuerait de servir des assets figés.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => r.unregister()))
        .catch(() => {})
      return
    }

    let reloading = false

    // Le nouveau worker a pris la main : on recharge pour servir la version à jour.
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    const promptUpdate = (worker: ServiceWorker) => {
      toast('Une nouvelle version de Qonforme est disponible', {
        description: 'Actualisez pour en profiter.',
        duration: Infinity,
        action: {
          label: 'Actualiser',
          onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }),
        },
      })
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Un worker attend déjà : mise à jour téléchargée lors d'une visite précédente.
        if (registration.waiting && navigator.serviceWorker.controller) {
          promptUpdate(registration.waiting)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return

          installing.addEventListener('statechange', () => {
            // `controller` absent = toute première installation : rien à signaler.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              promptUpdate(installing)
            }
          })
        })
      })
      .catch(() => {
        // Enregistrement impossible (navigation privée, HTTP, réglage utilisateur).
        // L'app reste pleinement fonctionnelle en ligne : échec silencieux.
      })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
