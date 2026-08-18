'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlatform, isNativeApp } from '@/lib/native/platform'
import { initPushNotifications } from '@/lib/native/push'
import { closeExternalBrowser } from '@/lib/native/browser'

/**
 * Initialise la coquille native au démarrage.
 *
 * Monté dans le layout racine, ce composant ne fait strictement rien sur le web :
 * `isNativeApp()` court-circuite tout, et les plugins ne sont importés qu'après
 * ce test, donc le bundle du navigateur ne les embarque pas.
 */
export function NativeAppInit() {
  const router = useRouter()

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

  /* ── Notifications push — seulement une fois l'utilisateur connecté ─────── */
  useEffect(() => {
    if (!isNativeApp()) return

    const supabase = createClient()
    let initialised = false

    const start = () => {
      // iOS ne montre la demande d'autorisation qu'une fois par installation :
      // on ne la déclenche pas deux fois dans la même session.
      if (initialised) return
      initialised = true
      initPushNotifications((path) => router.push(path))
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) start()
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) start()
    })

    return () => subscription.subscription.unsubscribe()
  }, [router])

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

  return null
}
