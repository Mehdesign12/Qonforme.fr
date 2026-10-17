"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, BrickWall, ChevronLeft, ChevronRight, PlugZap } from "lucide-react"
import { Doodles } from "@/components/brand/Doodles"
import { D_WRAP } from "@/components/design/kit"
import { usePrefersReducedMotion } from "@/components/landing/carousels"
import { SectionTitle } from "@/components/landing/ui"
import { PHOTOS, type LandingPhoto } from "@/lib/landing/photos"
import { cn } from "@/lib/utils"

/**
 * Carrousel des métiers de la variante B de l'accueil (/design) : une carte par
 * métier du bâtiment, vers sa page « Logiciel de devis pour … ».
 *
 *  - défilement natif (scroll-snap) : au doigt, au pavé tactile, au clavier
 *    (la piste prend le focus) et sans JavaScript ; aucune lecture automatique ;
 *  - la piste part de la colonne de 1 200 px et déborde à droite : 1,2 carte
 *    visible sur téléphone, 2,3 dès 640 px, 3,3 dès 768 px, 4,3 dès 1 024 px ;
 *  - flèches et barres de pagination tenues à jour au défilement (écoute
 *    passive, une mesure par image) et au redimensionnement ; un groupe = les
 *    cartes entièrement visibles, la flèche avance d'un groupe ;
 *  - « Réduire les animations » : défilement immédiat, sans glissé ;
 *  - aucune apparition au défilement sur les cartes : ScrollReveal les cacherait
 *    tant qu'elles sont hors de l'écran sur le côté. Ni backdrop-filter ni
 *    will-change (règle iOS de CLAUDE.md).
 */

interface Trade {
  slug: string
  nom: string
  text: string
  photo: LandingPhoto | null
}

const NB = "\u00a0"

const TRADES: Trade[] = [
  { slug: "electricien", nom: "Électricien", photo: PHOTOS.sansLogiciel, text: `Tableaux, mises aux normes, dépannages${NB}: chaque ligne avec sa TVA, du devis à la facture.` },
  { slug: "plombier", nom: "Plombier", photo: PHOTOS.plombier, text: "Fourniture et pose sur des lignes séparées, devis chiffré chez le client." },
  { slug: "macon", nom: "Maçon", photo: PHOTOS.macon, text: "Métrés au m² et au m³, acompte à la commande, facture à la fin du chantier." },
  { slug: "peintre", nom: "Peintre", photo: PHOTOS.appelFinal, text: "Surfaces, couches et finitions détaillées, préparation des supports comprise." },
  { slug: "carreleur", nom: "Carreleur", photo: PHOTOS.carreleur, text: "Surfaces au m², fourniture et pose distinguées, TVA de chaque ligne." },
  { slug: "menuisier", nom: "Menuisier", photo: PHOTOS.menuisier, text: "Fabrication sur mesure et pose, à l'atelier comme chez le client." },
  { slug: "couvreur", nom: "Couvreur", photo: PHOTOS.couvreur, text: `Tuiles, zinguerie et réparations${NB}: un devis clair avant de monter sur le toit.` },
  { slug: "plaquiste", nom: "Plaquiste", photo: PHOTOS.plaquiste, text: "Cloisons, doublages et faux plafonds au m², isolation à part." },
  { slug: "chauffagiste", nom: "Chauffagiste", photo: PHOTOS.chauffagiste, text: "Matériel, main-d'œuvre et mise en service sur des lignes distinctes." },
]

/*
 * Alignement sur la colonne de 1 200 px (même calcul que px-6 + max-w-[1200px]) ;
 * le pourcentage se rapporte à la largeur de la section, celle de la piste.
 * Le pseudo-élément ::after laisse la marge de fin (gouttière + 24 px en tout).
 */
const TRACK =
  "dz-snap flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain py-4 sm:gap-5 " +
  "pl-[max(24px,calc((100%_-_1200px)_/_2))] scroll-pl-[max(24px,calc((100%_-_1200px)_/_2))] " +
  "after:w-2 after:shrink-0 after:content-[''] sm:after:w-1 " +
  "rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-q-accent"

/* Largeur d'une carte : 100 % = la partie visible de la piste (de la colonne au bord droit) */
const CARD =
  "shrink-0 snap-start w-[calc((100%_-_16px)_/_1.2)] sm:w-[calc((100%_-_40px)_/_2.3)] " +
  "md:w-[calc((100%_-_60px)_/_3.3)] lg:w-[min(360px,calc((100%_-_80px)_/_4.3))]"

interface Pager {
  pages: number
  page: number
  atStart: boolean
  atEnd: boolean
}

export function TradesCarousel() {
  const trackRef = useRef<HTMLUListElement>(null)
  const stepRef = useRef(0)
  const reduced = usePrefersReducedMotion()
  const [pager, setPager] = useState<Pager>({ pages: 0, page: 0, atStart: true, atEnd: false })

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const style = getComputedStyle(el)
    const gap = parseFloat(style.columnGap) || 0
    const padLeft = parseFloat(style.paddingLeft) || 0
    const first = el.querySelector("li")
    const pitch = first ? first.getBoundingClientRect().width + gap : el.clientWidth
    // Un groupe : les cartes entièrement visibles (au moins une)
    const perPage = Math.max(1, Math.floor((el.clientWidth - padLeft + gap) / pitch))
    const step = perPage * pitch
    stepRef.current = step

    const max = el.scrollWidth - el.clientWidth
    const x = el.scrollLeft
    const atStart = x <= 1
    const atEnd = x >= max - 1
    // Un reste de moins d'un dixième de groupe ne fait pas un groupe de plus
    const pages = max > 1 ? Math.ceil(max / step - 0.1) + 1 : 1
    const page = atEnd ? pages - 1 : Math.min(pages - 1, Math.max(0, Math.round(x / step)))

    setPager((p) =>
      p.pages === pages && p.page === page && p.atStart === atStart && p.atEnd === atEnd ? p : { pages, page, atStart, atEnd },
    )
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    measure()
    el.addEventListener("scroll", schedule, { passive: true })
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule)
      ro.observe(el)
    } else {
      window.addEventListener("resize", schedule)
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener("scroll", schedule)
      if (ro) ro.disconnect()
      else window.removeEventListener("resize", schedule)
    }
  }, [measure])

  const behavior: ScrollBehavior = reduced ? "auto" : "smooth"
  const by = (dir: 1 | -1) => trackRef.current?.scrollBy({ left: dir * stepRef.current, behavior })
  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    el.scrollTo({ left: i >= pager.pages - 1 ? max : Math.min(max, i * stepRef.current), behavior })
  }

  return (
    <section className="relative bg-q-surface py-[clamp(80px,9vw,120px)]">
      <Doodles layout="sides-short" icons={[PlugZap, BrickWall]} />
      <div className="px-6">
        <div className={D_WRAP}>
          <SectionTitle align="center" title="Un logiciel pensé" accent="pour tous les artisans du bâtiment." />
        </div>
      </div>

      <div data-reveal="" className="mt-8 sm:mt-10">
        <ul ref={trackRef} aria-label="Métiers du bâtiment" tabIndex={0} className={TRACK}>
          {TRADES.map((t) =>
            t.photo ? (
              <li key={t.slug} className={CARD}>
                <Link
                  href={`/facturation/${t.slug}`}
                  onFocus={(e) => {
                    // Au clavier, la carte rejoint son point d'accroche au lieu de rester à moitié hors de l'écran
                    if (e.currentTarget.matches(":focus-visible")) {
                      e.currentTarget.parentElement?.scrollIntoView({ block: "nearest", inline: "start", behavior })
                    }
                  }}
                  className="lp-zoom-host group flex h-full flex-col overflow-hidden rounded-[20px] border border-q-line bg-q-surface transition-[border-color,box-shadow] duration-200 hover:border-q-wash-line hover:shadow-[0_22px_40px_-28px_rgba(10,17,34,.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent"
                >
                  <div className="lp-clip relative aspect-[4/3] bg-q-sunken">
                    {/* Décorative : le lien est nommé par le métier et sa phrase */}
                    <Image src={t.photo.src} alt="" fill sizes="320px" loading="lazy" className="lp-zoom object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h3 className="font-display text-[20px] font-semibold leading-[1.2] tracking-[-0.02em] text-q-ink-strong">{t.nom}</h3>
                    <p className="mt-2 text-[15px] leading-[1.55] text-q-text-3">{t.text}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[15px] font-semibold text-q-accent-strong">
                      En savoir plus
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" strokeWidth={1.75} aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      </div>

      <div className="px-6">
        <div className={cn(D_WRAP, "mt-4 flex items-center justify-end gap-4 sm:justify-start", pager.pages === 0 && "invisible")}>
          {/* Sous 640 px, un groupe par carte : trop de barres pour de bonnes cibles tactiles ; les flèches et le glisser suffisent */}
          <div role="group" aria-label="Groupes de métiers" className="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
            {Array.from({ length: pager.pages > 1 ? pager.pages : 0 }, (_, i) => {
              const on = i === pager.page
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Aller au groupe ${i + 1}`}
                  aria-current={on || undefined}
                  className={cn(
                    "group/bar grid h-6 flex-none items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent",
                    on ? "w-12 lg:w-16" : "w-8 lg:w-10",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "block h-1 w-full rounded-full transition-colors duration-300 motion-reduce:transition-none",
                      on ? "bg-q-accent" : "bg-q-text-4 group-hover/bar:bg-q-text-3",
                    )}
                  />
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ArrowButton dir={-1} disabled={pager.atStart} onClick={() => by(-1)} />
            <ArrowButton dir={1} disabled={pager.atEnd || pager.pages === 1} onClick={() => by(1)} />
          </div>
        </div>
        <p className={cn(D_WRAP, "mt-6")}>
          <Link href="/facturation" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-q-accent-strong hover:underline">
            Tous les métiers <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </p>
      </div>
    </section>
  )
}

function ArrowButton({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight
  return (
    // aria-disabled plutôt que disabled : un bouton désactivé perdrait le focus clavier (renvoyé sur <body>)
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      aria-label={dir < 0 ? "Métiers précédents" : "Métiers suivants"}
      className="grid h-10 w-10 place-items-center rounded-full border border-q-line bg-q-surface text-q-ink-strong transition-colors hover:border-q-field focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:border-q-line"
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  )
}
