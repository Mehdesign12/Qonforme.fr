'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { isNativeApp } from '@/lib/native/platform'

const PICTO_Q =
  'https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp'

/**
 * Cache le contenu de l'app dans le sélecteur d'apps iOS (App Switcher).
 *
 * Qonforme affiche des données financières (montants de factures, noms de
 * clients, IBAN...) — sans ce composant, l'aperçu du switcher les expose à
 * quiconque a un accès physique momentané au téléphone, sans même
 * déverrouiller l'app.
 *
 * `appStateChange` (isActive: false) se déclenche dès que l'app quitte le
 * premier plan — y compris pour une alerte système ou le centre de
 * contrôle, pas seulement un vrai passage en arrière-plan. C'est voulu :
 * c'est exactement l'instant où iOS capture l'aperçu du switcher.
 *
 * Cache opaque plutôt que flou : `backdrop-filter` est interdit sur mobile
 * (règle CLAUDE.md — crash GPU iOS au changement de thème). Un fond plein
 * est de toute façon un meilleur choix ici : rien n'est jamais
 * partiellement visible, contrairement à un flou.
 *
 * Monté indépendamment de `NativeAppInit` (pas le même cycle de vie —
 * transitoire et réactif au premier plan/arrière-plan, pas "une fois par
 * appareil") juste à côté dans `app/layout.tsx`.
 */
export function PrivacyScreen() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) return

    let remove: (() => void) | undefined

    ;(async () => {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          setHidden(!isActive)
        })
        remove = () => handle.remove()
      } catch {
        // Plugin indisponible : pas de cache, comportement par défaut d'iOS.
      }
    })()

    return () => remove?.()
  }, [])

  if (!hidden) return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background:
          'linear-gradient(250deg, #EFF6FF 0%, #DBEAFE 20%, #F0F9FF 45%, #F8FAFC 70%, #ffffff 100%)',
      }}
    >
      <Image src={PICTO_Q} alt="" width={72} height={72} className="opacity-90" sizes="72px" priority />
    </div>
  )
}
