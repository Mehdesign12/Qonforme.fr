"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, ChevronDown, Menu, X } from "lucide-react"
import { LOGO_LONG_BLUE, LOGO_LONG_LIGHT } from "@/lib/brand"
import { OUTILS_CATEGORIES, OUTILS_COUNT, OUTILS_ESSENTIELS } from "@/components/layout/public-links"
import { cn } from "@/lib/utils"

export interface PublicNavProps {
  /** Accueil : ancres locales (#features) au lieu de chemins absolus (/#features). */
  isLandingPage?: boolean
  /** Lien de retour propre à une rubrique (blog, outils), après le logo et en tête du menu mobile. */
  backLink?: { href: string; label: string }
  /** Page courante dans la rubrique (fil d'Ariane des outils), affichée après le lien de retour. */
  crumb?: string
}

const NAV_LINK =
  "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium whitespace-nowrap text-q-text-3 transition-colors hover:bg-q-hover hover:text-q-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent aria-[current=page]:font-semibold aria-[current=page]:text-q-ink"
const MENU_LINK =
  "flex min-h-[44px] items-center justify-between gap-3 rounded-[10px] px-3 text-[15px] font-medium text-q-text-2 transition-colors hover:bg-q-hover hover:text-q-ink aria-[current=page]:font-semibold aria-[current=page]:text-q-ink"
/** Bouton principal en pilule (.lp-btn-p), ramené à 40 px dans la barre (44 px sur mobile). */
const CTA = "lp-btn-p !h-11 !gap-2 !px-3.5 !text-sm lg:!h-10 lg:!px-[18px]"

/** Guide de la réforme (page publique stable, aussi liée depuis le pied de page). */
const REFORME_HREF = "/guide/facture-electronique-2026"

const SHADOW_REST = "0 1px 2px rgba(10,17,34,.04), 0 10px 28px -20px rgba(10,17,34,.20)"
const SHADOW_SCROLLED = "0 1px 2px rgba(10,17,34,.05), 0 14px 34px -18px rgba(10,17,34,.28)"

/**
 * En-tête unique des pages publiques (accueil, tarifs, blog, outils, guides,
 * pages légales), d'après le canevas « Main » : pilule blanche, logo à gauche,
 * liens au centre, « Se connecter » et « Créer mon compte » à droite.
 *
 * Fond opaque sur tous les écrans : aucun backdrop-filter ni will-change
 * (règle iOS de CLAUDE.md). Sous 1024 px, les liens passent dans un menu
 * déroulant sous la pilule (cibles de 44 px).
 */
export function PublicNav({ isLandingPage = false, backLink, crumb }: PublicNavProps) {
  const pathname = usePathname() ?? "/"
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [outilsOpen, setOutilsOpen] = useState(false)
  const [outilsMobileOpen, setOutilsMobileOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const outilsRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const outilsButtonRef = useRef<HTMLButtonElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Ouvert par le survol : le clic qui suit (souris, ou tap sur tablette) le garde ouvert au lieu de le refermer. */
  const openedByHover = useRef(false)
  const menuId = useId()
  const outilsId = useId()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Chaque navigation referme les menus
  useEffect(() => {
    setMenuOpen(false)
    setOutilsOpen(false)
  }, [pathname])

  // Passage en largeur ordinateur : le menu mobile n'a plus lieu d'être
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onChange = () => { if (mq.matches) setMenuOpen(false) }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  // Clic à l'extérieur et touche Échap
  useEffect(() => {
    if (!menuOpen && !outilsOpen) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (outilsOpen && outilsRef.current && !outilsRef.current.contains(target)) setOutilsOpen(false)
      if (menuOpen && navRef.current && !navRef.current.contains(target)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (outilsOpen) { setOutilsOpen(false); outilsButtonRef.current?.focus() }
      if (menuOpen) { setMenuOpen(false); menuButtonRef.current?.focus() }
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen, outilsOpen])

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])

  const openOutils = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (!outilsOpen) openedByHover.current = true
    setOutilsOpen(true)
  }
  const toggleOutils = () => {
    if (openedByHover.current) {
      openedByHover.current = false
      setOutilsOpen(true)
    } else {
      setOutilsOpen((v) => !v)
    }
  }
  const closeOutilsSoon = () => {
    hoverTimer.current = setTimeout(() => {
      openedByHover.current = false
      setOutilsOpen(false)
    }, 180)
  }

  const prefix = isLandingPage ? "" : "/"
  const isActive = (base: string) => pathname === base || pathname.startsWith(`${base}/`)
  const current = (base: string) => (isActive(base) ? ("page" as const) : undefined)

  // Libellés du canevas (Produit, Tarifs, Réforme 2027, Outils gratuits), vers
  // des destinations qui existent ; Blog et Démo restent accessibles.
  const leading = [
    { label: "Produit", href: `${prefix}#features`, current: undefined },
    { label: "Tarifs", href: isLandingPage ? "#pricing" : "/pricing", current: current("/pricing") },
    { label: "Réforme 2027", href: REFORME_HREF, current: current(REFORME_HREF) },
  ]
  const trailing = [
    { label: "Blog", href: "/blog", current: current("/blog") },
    { label: "Démo", href: "/demo", current: undefined },
  ]
  const outilsCurrent = current("/outils")
  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[100] px-4 pt-4 sm:px-6">
      <nav
        ref={navRef}
        aria-label="Navigation principale"
        className="pointer-events-auto relative mx-auto flex max-w-[1200px] items-center justify-between gap-2 rounded-full border border-q-line bg-q-surface py-2 pl-3.5 pr-2 transition-shadow duration-300 sm:pl-5 lg:gap-4 xl:grid xl:grid-cols-[1fr_auto_1fr]"
        style={{ boxShadow: scrolled || menuOpen ? SHADOW_SCROLLED : SHADOW_REST }}
      >
        {/* Logo (et retour de rubrique sur grand écran) */}
        <div className="flex min-w-0 items-center gap-3 justify-self-start">
          <Link
            href="/"
            aria-label="Qonforme, accueil"
            className="relative inline-flex shrink-0 items-center rounded-lg px-0.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"
          >
            {/* Boîte de 104 × 20 fixée en CSS (object-contain) : next/image ne signale plus de ratio modifié ; la variante sombre est superposée, pas masquée */}
            <Image src={LOGO_LONG_BLUE} alt="Qonforme" width={104} height={20} sizes="104px" priority className="h-5 w-[104px] object-contain object-left dark:opacity-0" />
            <Image src={LOGO_LONG_LIGHT} alt="" aria-hidden width={104} height={20} sizes="104px" className="absolute left-0.5 top-1 h-5 w-[104px] object-contain object-left opacity-0 dark:opacity-100" />
          </Link>
          {backLink && (
            <>
              <span aria-hidden className="hidden h-4 w-px bg-q-line xl:block" />
              <Link href={backLink.href} className={cn(NAV_LINK, "hidden px-2 text-[13px] xl:inline-flex")}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                {backLink.label}
              </Link>
              {crumb && (
                <span className="hidden min-w-0 max-w-[180px] truncate text-[13px] font-semibold text-q-ink xl:block" title={crumb}>
                  {crumb}
                </span>
              )}
            </>
          )}
        </div>

        {/* Liens (ordinateur) */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {leading.map((l) => (
            <Link key={l.label} href={l.href} aria-current={l.current} className={NAV_LINK}>{l.label}</Link>
          ))}

          {/* Outils gratuits : méga-menu au survol ou au clic */}
          <div ref={outilsRef} className="relative" onMouseEnter={openOutils} onMouseLeave={closeOutilsSoon}>
            <button
              ref={outilsButtonRef}
              type="button"
              aria-expanded={outilsOpen}
              aria-controls={outilsId}
              aria-current={outilsCurrent}
              onClick={toggleOutils}
              className={NAV_LINK}
            >
              Outils gratuits
              <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 transition-transform duration-200", outilsOpen && "rotate-180")} />
            </button>
            {outilsOpen && (
              <div className="absolute left-1/2 top-full z-[150] -translate-x-1/2 pt-3">
                <div
                  id={outilsId}
                  className="w-[720px] rounded-2xl border border-q-line bg-q-surface p-5 shadow-[var(--q-shadow-pop)] duration-150 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
                >
                  <div className="grid grid-cols-3 gap-5">
                    {OUTILS_CATEGORIES.map((cat) => (
                      <div key={cat.title}>
                        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-q-text-4">{cat.title}</p>
                        <ul className="flex flex-col gap-0.5">
                          {cat.items.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setOutilsOpen(false)}
                                aria-current={current(item.href)}
                                className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-q-hover aria-[current=page]:bg-q-wash"
                              >
                                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-q-wash text-q-accent-strong">
                                  <item.icon className="h-4 w-4" aria-hidden />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-semibold leading-tight text-q-ink">{item.label}</span>
                                  <span className="mt-0.5 block text-xs leading-tight text-q-text-4">{item.desc}</span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-q-line-soft bg-q-bg px-4 py-3">
                    <div>
                      <p className="text-[13px] font-semibold text-q-ink">Tous les outils gratuits</p>
                      <p className="text-xs text-q-text-4">{OUTILS_COUNT} outils pour gérer votre activité</p>
                    </div>
                    <Link href="/outils" onClick={() => setOutilsOpen(false)} className="q-btn q-btn-secondary q-btn-sm">
                      Voir tout <ArrowRight aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {trailing.map((l) => (
            <Link key={l.label} href={l.href} aria-current={l.current} className={NAV_LINK}>{l.label}</Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 justify-self-end">
          <Link href="/login" className={cn(NAV_LINK, "hidden md:inline-flex")}>Se connecter</Link>
          {/* Libellé court du canevas (« Commencer ») sur les petits téléphones ; sous 360 px, l'appel passe dans le menu */}
          <Link href="/signup" className={cn(CTA, "max-[359px]:!hidden")}>
            <span className="max-[374px]:hidden">Créer mon compte</span>
            <span className="hidden max-[374px]:inline">Commencer</span>
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full border text-q-ink transition-colors lg:hidden",
              menuOpen ? "border-q-field bg-q-sunken" : "border-q-line bg-q-surface hover:bg-q-hover",
            )}
          >
            {menuOpen ? <X className="h-[18px] w-[18px]" aria-hidden /> : <Menu className="h-[18px] w-[18px]" aria-hidden />}
          </button>
        </div>

        {/* Menu mobile : panneau sous la pilule */}
        {menuOpen && (
          <div
            id={menuId}
            className="absolute right-[-1px] top-[calc(100%+8px)] w-[calc(100%+2px)] overflow-y-auto overscroll-contain rounded-2xl border border-q-line bg-q-surface p-1.5 shadow-[var(--q-shadow-pop)] duration-150 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none sm:w-[360px] lg:hidden"
            style={{ maxHeight: "calc(100dvh - 104px)" }}
          >
            <ul className="flex flex-col gap-0.5">
              {backLink && (
                <li>
                  <Link href={backLink.href} onClick={closeMenu} className={cn(MENU_LINK, "justify-start text-q-accent-strong")}>
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">
                      {backLink.label}
                      {crumb && <span className="font-normal text-q-text-4"> · {crumb}</span>}
                    </span>
                  </Link>
                </li>
              )}
              {leading.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} onClick={closeMenu} aria-current={l.current} className={MENU_LINK}>{l.label}</Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  aria-expanded={outilsMobileOpen}
                  aria-current={outilsCurrent}
                  onClick={() => setOutilsMobileOpen((v) => !v)}
                  className={cn(MENU_LINK, "w-full text-left")}
                >
                  Outils gratuits
                  <ChevronDown aria-hidden className={cn("h-4 w-4 text-q-text-4 transition-transform duration-200", outilsMobileOpen && "rotate-180")} />
                </button>
                {outilsMobileOpen && (
                  <ul className="mb-1 flex flex-col gap-0.5 pl-2">
                    {OUTILS_ESSENTIELS.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeMenu}
                          aria-current={current(item.href)}
                          className="flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-q-text-2 transition-colors hover:bg-q-hover hover:text-q-ink aria-[current=page]:text-q-ink"
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-q-wash text-q-accent-strong">
                            <item.icon className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link href="/outils" onClick={closeMenu} className="flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-q-accent-strong hover:bg-q-hover">
                        Voir les {OUTILS_COUNT} outils <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
              {trailing.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} onClick={closeMenu} aria-current={l.current} className={MENU_LINK}>{l.label}</Link>
                </li>
              ))}
            </ul>
            <div className="mt-1 border-t border-q-line-soft pt-1.5 md:hidden">
              <Link href="/login" onClick={closeMenu} className={cn(MENU_LINK, "font-semibold text-q-ink")}>Se connecter</Link>
            </div>
            <div className="hidden p-1.5 pt-2 max-[359px]:block">
              <Link href="/signup" onClick={closeMenu} className="lp-btn-p !h-12 w-full !px-4 !text-[15px]">Créer mon compte</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
