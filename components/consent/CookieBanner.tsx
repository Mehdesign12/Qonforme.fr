"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Cookie } from "lucide-react"
import { cn } from "@/lib/utils"
import { isTrackingPage, SETTINGS_EVENT, writeConsent, type ConsentChoice } from "@/lib/consent"
import { useConsent } from "@/components/consent/use-consent"
import { ROUTES_WITH_BOTTOM_NAV } from "@/lib/bottom-nav-routes"

/** Laisse la page s'afficher avant de demander quoi que ce soit (LCP mobile). */
const APPEARANCE_DELAY_MS = 600
/** Durée de la sortie, alignée sur `duration-300`. */
const EXIT_MS = 300

const BUTTON =
  "h-9 flex-1 rounded-full px-5 text-[13px] font-semibold transition-colors sm:flex-none " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"

/**
 * Bandeau de consentement aux cookies : petit, en bas de l'écran, deux boutons
 * de même taille (refuser est aussi simple qu'accepter). Tant que le visiteur
 * n'a pas répondu, aucun traceur publicitaire n'est chargé
 * (`components/consent/TrackingLoader.tsx`). Fermer sans répondre n'existe pas.
 *
 * Surface `.q-float` : verre clair sur ordinateur, verre opaque sous 768 px, sans
 * `backdrop-filter` ni `will-change` sur mobile (règle iOS de CLAUDE.md). Seules
 * l'opacité et la translation sont animées, et pas du tout avec « Réduire les
 * animations ». Rien n'est rendu côté serveur : pas de décalage de mise en page.
 *
 * Rouvert par « Gérer les cookies » (pied de page, politique de confidentialité).
 */
export function CookieBanner() {
  const consent = useConsent()
  const pathname = usePathname() ?? "/"
  const [ready, setReady] = useState(false)
  const [reopened, setReopened] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [shown, setShown] = useState(false)
  const card = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), APPEARANCE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const open = () => setReopened(true)
    window.addEventListener(SETTINGS_EVENT, open)
    return () => window.removeEventListener(SETTINGS_EVENT, open)
  }, [])

  // Pas de bandeau sur les pages sans traceur (règlement, signature, admin…)
  const wanted = ready && isTrackingPage(pathname) && (consent === null || reopened)

  useEffect(() => {
    if (wanted) {
      setRendered(true)
      const frame = window.requestAnimationFrame(() => setShown(true))
      return () => window.cancelAnimationFrame(frame)
    }
    setShown(false)
    const id = window.setTimeout(() => setRendered(false), EXIT_MS)
    return () => window.clearTimeout(id)
  }, [wanted])

  // Rouvert au clavier ou à la souris depuis un lien : le focus arrive sur le bandeau
  useEffect(() => {
    if (reopened && shown) card.current?.focus()
  }, [reopened, shown])

  // Un bandeau rouvert se ferme avec Échap, choix inchangé
  useEffect(() => {
    if (!reopened) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReopened(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [reopened])

  if (!rendered) return null

  const choose = (choice: ConsentChoice) => {
    writeConsent(choice)
    setReopened(false)
  }

  const hasBottomNav = ROUTES_WITH_BOTTOM_NAV.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[65] flex justify-center px-3 print:hidden",
        "bottom-[calc(env(safe-area-inset-bottom,0px)_+_0.75rem)]",
        hasBottomNav && "max-md:bottom-[calc(env(safe-area-inset-bottom,0px)_+_5rem)]",
      )}
    >
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-label="Cookies"
        aria-describedby="cookie-desc"
        tabIndex={-1}
        className={cn(
          "q-float pointer-events-auto flex w-full max-w-[540px] flex-col gap-2.5 rounded-2xl px-3.5 py-3 outline-none",
          "sm:flex-row sm:items-center sm:gap-4 sm:py-2.5 sm:pl-4 sm:pr-3",
          "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
          shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Cookie aria-hidden className="mt-px size-[17px] shrink-0 text-q-accent" strokeWidth={1.75} />
          <p id="cookie-desc" className="text-[12.5px] leading-[1.45] text-q-text-2">
            <strong className="font-semibold text-q-ink-strong">Cookies</strong> de mesure et de publicité (Meta),
            seulement si vous acceptez.{" "}
            <Link
              href="/confidentialite#cookies"
              className="font-medium text-q-accent-strong underline decoration-q-wash-line underline-offset-2 hover:decoration-current"
            >
              En savoir plus
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("refused")}
            className={cn(BUTTON, "border border-q-line bg-q-surface text-q-ink hover:bg-q-hover")}
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className={cn(BUTTON, "border border-q-accent-strong bg-q-accent text-white hover:bg-q-accent-strong")}
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  )
}
