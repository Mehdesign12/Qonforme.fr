'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlatform, isNativeApp } from '@/lib/native/platform'
import {
  initPushNotifications,
  checkPushPermissionStatus,
  hasSeenPushPriming,
  markPushPrimingSeen,
} from '@/lib/native/push'
import { hasSeenAppOnboarding, markAppOnboardingSeen } from '@/lib/native/onboarding'
import { closeExternalBrowser } from '@/lib/native/browser'
import { PushPrimingScreen } from './PushPrimingScreen'
import { AppOnboardingCarousel } from './AppOnboardingCarousel'

/**
 * Initialise la coquille native au démarrage.
 *
 * Monté dans le layout racine, ce composant ne fait strictement rien sur le web :
 * `isNativeApp()` court-circuite tout, et les plugins ne sont importés qu'après
 * ce test, donc le bundle du navigateur ne les embarque pas.
 */
export function NativeAppInit() {
  const router = useRouter()
  const pathname = usePathname()
  // Un seul overlay plein écran à la fois — l'onboarding (découverte, avant
  // toute connexion) précède toujours l'amorçage push (déjà connecté).
  const [overlay, setOverlay] = useState<'onboarding' | 'push-priming' | null>(null)
  // Ne devient `true` qu'une fois l'onboarding vu — voir l'effet push plus bas,
  // qui en dépend pour ne jamais se superposer au carrousel de découverte.
  const [onboardingDone, setOnboardingDone] = useState(false)
  // Écran cible après un CTA de l'onboarding (Créer un compte / J'ai déjà un
  // compte) : l'overlay reste monté jusqu'à ce que la page en dessous ait
  // réellement changé, sinon /login (déjà chargée) flashe une fraction de
  // seconde avant que /signup ne prenne sa place.
  const [pendingDestination, setPendingDestination] = useState<'/login' | '/signup' | null>(null)

  /* ── Barre d'état, écran de démarrage, marqueur de plateforme ───────────── */
  useEffect(() => {
    if (!isNativeApp()) return

    document.documentElement.dataset.native = getPlatform()

    ;(async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        // `Style.Light` = texte sombre sur fond clair — le thème mobile est forcé en clair.
        await StatusBar.setStyle({ style: Style.Light })
      } catch {
        // Plugin absent : la barre d'état garde le style par défaut.
      }

      try {
        // `launchAutoHide: false` dans capacitor.config.ts : c'est ici qu'on
        // masque le splash, une fois React monté, pour éviter le flash blanc
        // entre la disparition du splash et le premier rendu.
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
      } catch {
        // Idem.
      }
    })()

    return () => {
      delete document.documentElement.dataset.native
    }
  }, [])

  /* ── Liens profonds : qonforme.fr/... ouvert depuis Mail, Messages… ─────── */
  useEffect(() => {
    if (!isNativeApp()) return

    let remove: (() => void) | undefined

    ;(async () => {
      try {
        const { App } = await import('@capacitor/app')

        const handle = await App.addListener('appUrlOpen', ({ url }) => {
          try {
            const target = new URL(url)
            // Un lien vers un autre domaine ne doit jamais être routé dans l'app.
            if (target.hostname !== 'qonforme.fr') return

            // Retour d'un paiement Stripe : la vue Safari doit se refermer.
            closeExternalBrowser()
            router.push(`${target.pathname}${target.search}`)
          } catch {
            // URL non analysable : ignorée.
          }
        })

        remove = () => handle.remove()
      } catch {
        // Plugin indisponible.
      }
    })()

    return () => remove?.()
  }, [router])

  /* ── Onboarding de découverte — une fois par appareil, avant toute connexion ─ */
  useEffect(() => {
    if (!isNativeApp()) return

    hasSeenAppOnboarding().then((seen) => {
      if (seen) {
        setOnboardingDone(true)
        return
      }
      setOverlay('onboarding')
    })
  }, [])

  const handleOnboardingFinish = (destination?: '/login' | '/signup') => {
    markAppOnboardingSeen()
    // Débloque l'effet d'amorçage push ci-dessous, qui attendait cette étape.
    setOnboardingDone(true)

    if (!destination) {
      // "Passer", ou fin du dernier "Suivant" : rien à charger, la page déjà
      // affichée en dessous (login ou dashboard, selon le middleware) est la bonne.
      setOverlay(null)
      return
    }

    // Le carrousel reste monté (avec son spinner) jusqu'à ce que la navigation
    // aboutisse réellement — voir l'effet ci-dessous sur `pathname`.
    setPendingDestination(destination)
    router.push(destination)
  }

  // Démonte l'overlay une fois que la page cible a effectivement pris la main.
  useEffect(() => {
    if (pendingDestination && pathname === pendingDestination) {
      setOverlay(null)
      setPendingDestination(null)
    }
  }, [pathname, pendingDestination])

  // Filet de sécurité : si la navigation n'aboutit jamais exactement au
  // pathname attendu (redirection intermédiaire, etc.), ne pas garder
  // quelqu'un bloqué indéfiniment derrière l'onboarding.
  useEffect(() => {
    if (!pendingDestination) return
    const timeout = setTimeout(() => {
      setOverlay(null)
      setPendingDestination(null)
    }, 1500)
    return () => clearTimeout(timeout)
  }, [pendingDestination])

  /* ── Notifications push — seulement une fois l'utilisateur connecté ─────── */
  useEffect(() => {
    if (!isNativeApp()) return
    // Ne jamais superposer l'amorçage push au carrousel de découverte : cet
    // effet se relance tout seul dès que `onboardingDone` bascule à `true`
    // (voir `handleOnboardingFinish`), donc rien à perdre à attendre ici.
    if (!onboardingDone) return

    const supabase = createClient()
    let initialised = false

    const start = async () => {
      // iOS ne montre la demande d'autorisation qu'une fois par installation :
      // on ne déclenche cette logique qu'une fois par session.
      if (initialised) return
      initialised = true

      const status = await checkPushPermissionStatus()

      if (status === 'granted') {
        // Déjà accepté lors d'une session précédente : réenregistrement
        // silencieux (le jeton APNs peut avoir changé), sans UI ni popup.
        initPushNotifications((path) => router.push(path))
        return
      }

      if (status !== 'prompt') return // 'denied' ou 'unavailable' : rien à proposer

      // Statut encore indécis : ne montrer l'amorçage qu'une seule fois par
      // appareil. S'il a déjà été vu (activé ou passé), on ne relance jamais
      // requestPermissions() tout seul — ça ferait réapparaître la popup
      // système froide, exactement ce que l'amorçage cherche à éviter.
      if (await hasSeenPushPriming()) return

      setOverlay('push-priming')
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) start()
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) start()
    })

    return () => subscription.subscription.unsubscribe()
  }, [router, onboardingDone])

  const handlePushPrimingActivate = () => {
    setOverlay(null)
    markPushPrimingSeen()
    initPushNotifications((path) => router.push(path))
  }

  const handlePushPrimingSkip = () => {
    setOverlay(null)
    markPushPrimingSeen()
  }

  /* ── Clavier : expose sa hauteur en variable CSS ────────────────────────── */
  useEffect(() => {
    if (!isNativeApp()) return

    let removeShow: (() => void) | undefined
    let removeHide: (() => void) | undefined

    ;(async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard')

        // Permet à un CTA collé en bas de remonter au-dessus du clavier
        // dans les formulaires de facture, via var(--keyboard-height).
        const show = await Keyboard.addListener('keyboardWillShow', (info) => {
          document.documentElement.style.setProperty(
            '--keyboard-height',
            `${info.keyboardHeight}px`,
          )
        })
        const hide = await Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.style.setProperty('--keyboard-height', '0px')
        })

        removeShow = () => show.remove()
        removeHide = () => hide.remove()
      } catch {
        // Plugin indisponible : la webview gère le clavier par défaut.
      }
    })()

    return () => {
      removeShow?.()
      removeHide?.()
    }
  }, [])

  if (overlay === 'onboarding') {
    return <AppOnboardingCarousel onFinish={handleOnboardingFinish} />
  }

  if (overlay === 'push-priming') {
    return (
      <PushPrimingScreen onActivate={handlePushPrimingActivate} onSkip={handlePushPrimingSkip} />
    )
  }

  return null
}
