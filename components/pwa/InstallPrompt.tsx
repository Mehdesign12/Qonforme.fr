'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Share, SquarePlus, X, Download } from 'lucide-react'
import { usePlatform } from '@/lib/pwa/hooks'
import { isInstallPromptSnoozed, snoozeInstallPrompt } from '@/lib/pwa/client'
import { isNativeApp } from '@/lib/native/platform'
import { cn } from '@/lib/utils'

/**
 * Événement Chromium — absent des types DOM standard car non normalisé.
 * iOS Safari ne l'émet jamais : l'ajout à l'écran d'accueil y reste manuel.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Sections dont le layout affiche une barre de navigation basse sur mobile. */
const ROUTES_WITH_BOTTOM_NAV = [
  '/dashboard',
  '/invoices',
  '/quotes',
  '/clients',
  '/products',
  '/purchase-orders',
  '/credit-notes',
  '/settings',
  '/demo',
]

/** Délai avant affichage — laisse la page se stabiliser avant d'interrompre. */
const APPEARANCE_DELAY_MS = 4000

/**
 * Invite à installer Qonforme sur l'écran d'accueil.
 *
 * Deux parcours très différents :
 *   - iOS Safari n'expose aucune API d'installation → on affiche la marche à suivre ;
 *   - Chromium émet `beforeinstallprompt` → on déclenche la boîte native.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi vérifier isNativeApp() en plus de isSafari()
 * ─────────────────────────────────────────────────────────────────────────────
 * La WKWebView de la coquille Capacitor s'annonce comme Safari dans son user
 * agent : `isIOS() && isSafari()` renvoie donc `true` aussi à l'intérieur de
 * l'app installée, où « Appuyez sur Partager dans la barre Safari » n'a
 * aucun sens — l'utilisateur a déjà l'app ouverte. Repéré en test réel sur
 * simulateur : la bannière s'affichait par-dessus l'écran de connexion natif.
 */
export function InstallPrompt() {
  const pathname = usePathname()
  const { ready, isIOS, isSafari, isStandalone } = usePlatform()

  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Empêche la mini-infobar Chrome pour présenter notre propre invite.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    // L'app vient d'être installée : plus aucune raison d'insister.
    const onInstalled = () => setVisible(false)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // iOS n'a pas d'événement d'installation : on se fie à la plateforme détectée.
  const canPromptNatively = deferredPrompt !== null
  const canShowIosGuide = isIOS && isSafari

  useEffect(() => {
    if (!ready || isStandalone) return
    // Déjà dans l'app installée : proposer de l'installer n'a pas de sens.
    if (isNativeApp()) return
    if (!canPromptNatively && !canShowIosGuide) return
    if (isInstallPromptSnoozed()) return

    const timer = window.setTimeout(() => setVisible(true), APPEARANCE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [ready, isStandalone, canPromptNatively, canShowIosGuide])

  const dismiss = useCallback(() => {
    setVisible(false)
    snoozeInstallPrompt()
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    await deferredPrompt.userChoice

    // L'événement n'est utilisable qu'une fois.
    setDeferredPrompt(null)
    setVisible(false)
  }, [deferredPrompt])

  if (!visible) return null

  const hasBottomNav = ROUTES_WITH_BOTTOM_NAV.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  return (
    <div
      role="dialog"
      aria-label="Installer l'application Qonforme"
      className={cn(
        'fixed inset-x-3 z-[60] md:inset-x-auto md:right-6 md:w-[26rem]',
        'rounded-2xl border border-[#E2E8F0] dark:border-[#1E3A5F]',
        'bg-white dark:bg-[#111C31] shadow-[0_12px_40px_rgba(15,23,42,0.16)]',
        'p-4 animate-in fade-in slide-in-from-bottom-4 duration-300',
      )}
      style={{
        /*
         * On ajoute la marge à la zone sûre au lieu d'en prendre le maximum :
         * sur un iPhone à barre d'accueil, `max(1rem, 34px)` collerait la carte
         * juste sur l'indicateur. `calc()` laisse une vraie respiration.
         * La barre de navigation basse occupe ~4,5rem sur les routes applicatives.
         */
        bottom: hasBottomNav
          ? 'calc(env(safe-area-inset-bottom, 0px) + 5rem)'
          : 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer cette proposition"
        className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <Image
          src="/web-app-manifest-192x192.png"
          alt=""
          width={44}
          height={44}
          sizes="44px"
          className="shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight text-[#0F172A] dark:text-[#E2E8F0]">
            Installer Qonforme
          </p>
          <p className="mt-1 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {canShowIosGuide
              ? 'Ajoutez l’app à votre écran d’accueil pour un accès plein écran, sans barre de navigateur.'
              : 'Accédez à vos factures en un geste, comme une application native.'}
          </p>
        </div>
      </div>

      {canShowIosGuide ? (
        // Aucune API ne permet d'installer depuis le code sur iOS : on guide l'utilisateur.
        <ol className="mt-3.5 space-y-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B1220] p-3">
          <li className="flex items-center gap-2.5 text-[13px] text-[#0F172A] dark:text-[#E2E8F0]">
            <Share className="h-4 w-4 shrink-0 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>
              Appuyez sur <strong className="font-semibold">Partager</strong> dans la barre Safari
            </span>
          </li>
          <li className="flex items-center gap-2.5 text-[13px] text-[#0F172A] dark:text-[#E2E8F0]">
            <SquarePlus className="h-4 w-4 shrink-0 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>
              Choisissez <strong className="font-semibold">Sur l’écran d’accueil</strong>
            </span>
          </li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={install}
          className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
        >
          <Download className="h-4 w-4" />
          Installer l’application
        </button>
      )}
    </div>
  )
}
