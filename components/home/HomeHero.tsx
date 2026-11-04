import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronRight, Monitor } from "lucide-react"
import { CheckList, D_WRAP, GridLines, SIGNUP_HREF } from "@/components/home/kit"
import { HeroParallax } from "@/components/home/HeroParallax"
import { TradesStripLive, type TradeItem } from "@/components/home/TradesStrip"
import { CtaButtons } from "@/components/landing/ui"
import { SolutionCompatible } from "@/components/brand/SolutionCompatible"
import { PHOTOS } from "@/lib/landing/photos"
import { PLATFORM_SENDING_LIVE } from "@/lib/pa/sending"
import { PLANS } from "@/lib/stripe/plans"
import { cn } from "@/lib/utils"

/**
 * Haut de l'accueil : héros en deux colonnes, bandeau de la facture
 * électronique, rangée des métiers. Le label « Solution compatible » (DGFiP)
 * tient la place d'une note d'avis, les métiers du bâtiment celle de logos de
 * presse : aucun avis, aucune note, aucun logo qui ne soit vrai.
 *
 * Copywriting de conversion (DECISIONS-STRATEGIQUES.md § 2, 04/11/2026) :
 * le bénéfice d'abord, la promesse « chiffrer, organiser, encaisser ».
 *
 * Règles (CLAUDE.md) : contenu vrai seulement ; RIEN posé sur la photo (aucun
 * élément flottant, décision du fondateur) ; icônes au trait, sans tuile ni
 * pastille ; entrée du héros en CSS pur (.lp-fade-up, .dz-arch-in), parallaxe de l'artisan
 * par HeroParallax (translate seul),
 * jouée une seule fois avant l'hydratation et annulée par « Réduire les
 * animations » ; ni backdrop-filter ni will-change.
 */

/*
 * L'artisan du héros (04/11/2026, canevas https://claude.ai/artifact/XFVvBbReSVjNk4S3amdbBe,
 * ordinateur et version B du téléphone choisis par le fondateur) : un détourage sur fond
 * transparent qui dépasse de son cadre par le haut et les côtés ; le bas de l'image est
 * coupé au bord du cadre, la parallaxe (HeroParallax) ne fait jamais voir cette coupe.
 *
 * Arche (ordinateur) : coins du haut en demi-cercle, coins du bas arrondis à 28 px.
 * Rayons du haut en pourcentages (50 % de la largeur, 40 % de la hauteur pour un
 * cadre 4/5) et non « 999px » : le navigateur réduirait alors TOUS les rayons
 * dans la même proportion, et les coins du bas tomberaient à 6 px environ.
 * Téléphone et tablette : une carte bleue sous le texte, d'où l'artisan sort.
 */
const ARCH = "lg:rounded-t-[50%_40%] lg:rounded-b-[28px]"

// La signature en ligne demande Essentiel : elle n'est pas promise à côté de « gratuits »
const PROMISES = [
  "Devis gratuits et illimités, prêts en quelques minutes",
  "Chantier, planning et notes au même endroit",
  "Factures conformes, envoyées en un clic",
  "Relances automatiques : payé sans courir après",
]
const MOBILE_PROMISE = "Devis gratuits, chantier, planning, factures conformes et relances automatiques, au même endroit."

const ARTISAN = {
  src: "/landing/hero/artisan-quatre-bras.webp",
  width: 1229,
  height: 1280,
  alt: "Un artisan du bâtiment aux quatre bras tient un marteau, une pelle, des plans, un devis signé et un ordinateur portable",
}

/** Label et phrase sous le héros : à côté des boutons sur ordinateur, sous l'artisan sur téléphone. */
function HeroReassurance({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={className}>
      <SolutionCompatible priority={priority} />
      <p className="max-w-[300px] text-[14px] leading-[1.55] text-q-text-3">
        {"Zéro euro pour chiffrer. Tout ce qu'il faut pour encaisser. Sans carte bancaire."}
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   A — Héros : texte à gauche (7/12), artisan dans l'arche (5/12) ;
   en dessous de 1 024 px : texte centré, puis l'artisan qui sort
   du bandeau bleu
───────────────────────────────────────────────────────── */
function HeroArtisan() {
  return (
    <div className="lg:col-span-5">
      {/* Marge droite et basse (ordinateur) : la place du liseré décalé */}
      <div className="dz-arch-in relative mx-auto w-full max-w-[420px] lg:max-w-[436px] lg:pb-4 lg:pr-4">
        <div className="relative aspect-[358/420] lg:aspect-[4/5]">
          <div aria-hidden className={cn("absolute inset-0 hidden translate-x-4 translate-y-4 rounded-[28px] border border-q-wash-line lg:block", ARCH)} />
          <div aria-hidden className={cn("absolute inset-x-0 bottom-0 top-[28.6%] overflow-hidden rounded-[28px] bg-[#2563EB] lg:top-0 lg:bg-q-wash", ARCH)}>
            {[25, 50, 75].map((x) => (
              <span key={x} className="absolute inset-y-0 border-l border-dashed border-white/20 lg:hidden" style={{ left: `${x}%` }} />
            ))}
          </div>
          {/* Le cadre coupe le bas de l'image ; par le haut et les côtés, l'artisan dépasse */}
          <div className="absolute -left-[4%] -right-[4%] bottom-0 top-0 overflow-hidden lg:-left-[40%] lg:-right-[40%] lg:-top-[60%]">
            <HeroParallax max={40} maxMobile={18} className="absolute inset-0">
              <Image
                src={ARTISAN.src}
                alt={ARTISAN.alt}
                width={ARTISAN.width}
                height={ARTISAN.height}
                priority
                sizes="(min-width: 1024px) 620px, 400px"
                className="absolute left-1/2 top-[12%] h-auto w-[98%] max-w-none -translate-x-1/2 lg:bottom-[-6%] lg:top-auto lg:w-[72%] xl:w-[82%]"
              />
            </HeroParallax>
          </div>
        </div>
      </div>
      <HeroReassurance className="mt-8 flex flex-col items-center gap-3 text-center lg:hidden" />
    </div>
  )
}

export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="relative bg-q-surface px-6 pb-[clamp(32px,6vw,80px)] pt-[100px] sm:pt-[136px]">
      {/* Fond en lignes pointillées, le même que la section « Créez vos devis » */}
      <GridLines />
      <div className={cn(D_WRAP, "grid grid-cols-1 items-center gap-0 sm:gap-4 lg:grid-cols-12 lg:gap-10")}>
        <div className="flex flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-left">
          <a
            href="#facture-electronique"
            className="lp-fade-up group flex max-w-full items-center gap-2 rounded-full border border-q-line bg-q-surface py-[3px] pl-[3px] pr-2.5 text-[12px] leading-[1.3] text-q-text-2 sm:gap-2.5 sm:py-[5px] sm:pl-[5px] sm:pr-3.5 sm:text-[13.5px] sm:shadow-[0_1px_2px_rgba(10,17,34,.04)] sm:transition-[border-color,box-shadow] sm:hover:border-q-field sm:hover:shadow-[0_1px_2px_rgba(10,17,34,.05),0_8px_20px_-12px_rgba(10,17,34,.22)]"
          >
            <span className="shrink-0 whitespace-nowrap rounded-full bg-[#0A1122] px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-[12px] font-semibold tracking-[.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14)]">
              Nouveau
            </span>
            <span className="sm:hidden">{PLATFORM_SENDING_LIVE ? "Facture électronique : envoi ouvert" : "Solution compatible facturation électronique"}</span>
            <span className="hidden sm:inline">
              {PLATFORM_SENDING_LIVE ? "Facture électronique : envoi et réception ouverts" : "Qonforme est solution compatible facturation électronique"}
            </span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-q-text-4 transition-transform group-hover:translate-x-0.5 sm:block" strokeWidth={2} aria-hidden />
          </a>

          <h1
            id="hero-title"
            className="lp-fade-up mt-5 font-display text-[clamp(31px,8.6vw,38px)] sm:mt-7 sm:text-[clamp(38px,4.6vw,62px)] font-semibold leading-[1.04] tracking-[-0.04em] text-q-ink-strong [text-wrap:balance]"
            style={{ animationDelay: ".08s" }}
          >
            Chiffrez, organisez, encaissez.{" "}
            {/* Seconde voix toujours sur sa propre ligne */}
            <span className="q-serif block">Tout votre chantier dans une seule appli.</span>
          </h1>

          {/* Ordinateur : les quatre coches ; téléphone et tablette : une phrase, pour laisser la place à l'artisan */}
          <div className="lp-fade-up mt-8 hidden lg:block" style={{ animationDelay: ".16s" }}>
            <CheckList items={PROMISES} className="gap-3" />
          </div>
          <p className="lp-fade-up mt-4 max-w-[340px] text-[15px] leading-[1.5] text-q-text-3 sm:max-w-[460px] sm:text-[17px] lg:hidden" style={{ animationDelay: ".16s" }}>
            {MOBILE_PROMISE}
          </p>

          <div className="lp-fade-up mt-5 w-full max-lg:[&_.lp-btn-s]:hidden sm:mt-8 lg:mt-9" style={{ animationDelay: ".24s" }}>
            <CtaButtons className="lg:mx-0 lg:justify-start" primary={{ href: SIGNUP_HREF, label: "Faire mon premier devis gratuit" }} />
          </div>
          <Link
            href="/demo"
            className="lp-fade-up mt-2 inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-q-accent-strong hover:underline lg:hidden"
            style={{ animationDelay: ".28s" }}
          >
            <Monitor className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            Voir la démo
          </Link>

          {/* Label de la DGFiP : règles de la charte dans components/brand/SolutionCompatible.tsx */}
          <HeroReassurance
            priority
            className="lp-fade-up mt-8 hidden items-center gap-5 lg:flex"
          />
        </div>

        <HeroArtisan />
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   B — Bandeau de la facture électronique (cible de la
   pastille du héros)
───────────────────────────────────────────────────────── */
const EINVOICING_PILLS = PLATFORM_SENDING_LIVE
  ? ["Envoi et réception", "Factur-X", `Inclus dans ${PLANS.starter.name}`]
  : ["Factur-X", "Mentions obligatoires", "Numérotation continue"]

export function EInvoicingBand() {
  return (
    <section
      id="facture-electronique"
      aria-labelledby="facture-electronique-title"
      className="scroll-mt-24 bg-q-surface px-6 pb-[clamp(32px,4vw,48px)]"
    >
      <div
        data-reveal=""
        className={cn(
          D_WRAP,
          "grid grid-cols-1 items-center gap-8 rounded-[22px] border border-q-line bg-q-bg p-6 sm:p-9 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12 lg:px-12 lg:py-10",
        )}
      >
        <div className="flex flex-col items-start">
          <h2
            id="facture-electronique-title"
            className="font-display text-[clamp(22px,2vw,24px)] font-semibold leading-[1.2] tracking-[-0.025em] text-q-ink-strong [text-wrap:balance]"
          >
            {PLATFORM_SENDING_LIVE ? (
              <>
                Facture électronique 2027&nbsp;: <span className="q-serif">vous êtes déjà prêt.</span>
              </>
            ) : (
              "Solution compatible facturation électronique"
            )}
          </h2>
          <p className="mt-3 max-w-[560px] text-[16px] leading-[1.6] text-q-text-3 [text-wrap:pretty]">
            {PLATFORM_SENDING_LIVE ? (
              <>
                Qonforme envoie et reçoit vos factures par la plateforme agréée Super PDP, au format exigé par la réforme. Le 1er&nbsp;septembre 2027, vous n&apos;aurez rien à changer.
              </>
            ) : (
              <>
                Qonforme est raccordé à une plateforme agréée. Le 1er&nbsp;septembre 2027, les TPE et PME émettront leurs factures entre entreprises en électronique&nbsp;: votre logiciel suit la réforme.
              </>
            )}
          </p>
          <Link
            href="/guide/facture-electronique-2026"
            className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-q-accent-strong hover:underline"
          >
            Ce que la réforme change pour vous <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <SolutionCompatible />
          <ul className="flex flex-wrap gap-2 md:max-w-[300px] md:justify-end xl:max-w-none">
            {EINVOICING_PILLS.map((p) => (
              <li
                key={p}
                className="inline-flex h-8 items-center rounded-full border border-q-line bg-q-surface px-3.5 text-[13.5px] font-medium text-q-text-2"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   C — Rangée des métiers (à la place des logos de presse) :
   des liens vers les pages métier ; au survol, la carte photo
   du métier suit la souris (components/home/TradesStrip.tsx)
───────────────────────────────────────────────────────── */
const TRADES: TradeItem[] = [
  // La photo « sansLogiciel » est celle de l'électricien (lib/landing/photos.ts), « appelFinal » celle du peintre
  { label: "Électriciens", slug: "electricien", photo: PHOTOS.sansLogiciel, focus: "50% 12%" },
  { label: "Plombiers", slug: "plombier", photo: PHOTOS.plombier, focus: "50% 45%" },
  { label: "Maçons", slug: "macon", photo: PHOTOS.macon, focus: "50% 40%" },
  { label: "Peintres", slug: "peintre", photo: PHOTOS.appelFinal, focus: "50% 28%" },
  { label: "Carreleurs", slug: "carreleur", photo: PHOTOS.carreleur, focus: "50% 55%" },
  { label: "Menuisiers", slug: "menuisier", photo: PHOTOS.menuisier, focus: "50% 55%" },
  { label: "Couvreurs", slug: "couvreur", photo: PHOTOS.couvreur, focus: "50% 40%" },
].map((t) => ({ ...t, photo: t.photo ? { src: t.photo.src, width: t.photo.width, height: t.photo.height } : null }))

export function TradesStrip() {
  return (
    <section aria-labelledby="metiers-titre" className="bg-q-surface px-6 pb-[clamp(56px,7vw,88px)] pt-[clamp(16px,2vw,24px)]">
      <div className={D_WRAP}>
        <p id="metiers-titre" data-reveal="" className="text-center text-[13px] font-medium text-q-text-4">
          Pensé pour les artisans du bâtiment
        </p>
        {/* Rangées incomplètes centrées : 2 par ligne sur téléphone, 4 sur tablette, 7 sur grand écran */}
        <TradesStripLive items={TRADES} />
      </div>
    </section>
  )
}
