import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BrickWall, ChevronRight, Droplets, Grid3x3, Hammer, House, PaintRoller, PlugZap } from "lucide-react"
import { CheckList, D_WRAP, SIGNUP_HREF } from "@/components/design/kit"
import { CtaButtons } from "@/components/landing/ui"
import { SolutionCompatible } from "@/components/brand/SolutionCompatible"
import { PHOTOS } from "@/lib/landing/photos"
import { cn } from "@/lib/utils"

/**
 * Haut de la variante B de l'accueil (/design) : héros en deux colonnes, bandeau
 * de la facture électronique, rangée des métiers. Sur le modèle du concurrent :
 * la note Google devient le label « Solution compatible » (DGFiP), les logos de
 * presse deviennent les métiers du bâtiment.
 *
 * Règles (CLAUDE.md) : contenu vrai seulement ; RIEN posé sur la photo (aucun
 * élément flottant, décision du fondateur) ; icônes au trait, sans tuile ni
 * pastille ; entrée du héros en CSS pur (.lp-fade-up, .dz-arch-in, .dz-kenburns),
 * jouée une seule fois avant l'hydratation et annulée par « Réduire les
 * animations » ; ni backdrop-filter ni will-change.
 */

/*
 * Arche : coins du haut en demi-cercle, coins du bas arrondis à 28 px.
 * Rayons du haut en pourcentages (50 % de la largeur, 40 % de la hauteur pour un
 * cadre 4/5) et non « 999px » : le navigateur réduirait alors TOUS les rayons
 * dans la même proportion, et les coins du bas tomberaient à 6 px environ.
 */
const ARCH = "aspect-[4/5] rounded-t-[50%_40%] rounded-b-[28px]"

const PROMISES = [
  "Vos devis, gratuits et sans limite",
  "Vos factures envoyées par email, avec votre IBAN",
  "Les relances des impayés, sans vous",
  "Sur ordinateur et sur téléphone, rien à installer",
]

/* ─────────────────────────────────────────────────────────
   A — Héros : texte à gauche (7/12), photo en arche (5/12)
───────────────────────────────────────────────────────── */
function HeroPhoto() {
  const photo = PHOTOS.nouvelInstalle
  if (!photo) return null
  return (
    <div className="lg:col-span-5">
      {/* Marge droite et basse : la place du liseré décalé, sans débordement sur téléphone */}
      <div className="dz-arch-in relative mx-auto w-full max-w-[376px] pb-4 pr-4 lg:max-w-[476px]">
        <div className="relative">
          <div aria-hidden className={cn(ARCH, "absolute inset-0 translate-x-4 translate-y-4 border border-q-wash-line")} />
          <div className={cn(ARCH, "lp-clip relative bg-q-bg")}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority
              sizes="(min-width: 1024px) 460px, 360px"
              className="dz-kenburns object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function DesignHero() {
  return (
    <section aria-labelledby="hero-title" className="relative bg-q-surface px-6 pb-[clamp(48px,6vw,80px)] pt-[112px] sm:pt-[136px]">
      <div className={cn(D_WRAP, "grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10")}>
        <div className="flex flex-col items-start lg:col-span-7">
          <a
            href="#facture-electronique"
            className="lp-fade-up group flex max-w-full flex-col items-start gap-2.5 text-[13.5px] leading-[1.35] text-q-text-2 sm:flex-row sm:items-center sm:rounded-full sm:border sm:border-q-line sm:bg-q-surface sm:py-[5px] sm:pl-[5px] sm:pr-3.5 sm:shadow-[0_1px_2px_rgba(10,17,34,.04)] sm:transition-[border-color,box-shadow] sm:hover:border-q-field sm:hover:shadow-[0_1px_2px_rgba(10,17,34,.05),0_8px_20px_-12px_rgba(10,17,34,.22)]"
          >
            <span className="shrink-0 whitespace-nowrap rounded-full bg-[#0A1122] px-2.5 py-1 text-[12px] font-semibold tracking-[.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14)]">
              Nouveau
            </span>
            <span>Qonforme est solution compatible facturation électronique</span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-q-text-4 transition-transform group-hover:translate-x-0.5 sm:block" strokeWidth={2} aria-hidden />
          </a>

          <h1
            id="hero-title"
            className="lp-fade-up mt-7 font-display text-[clamp(38px,4.6vw,62px)] font-semibold leading-[1.04] tracking-[-0.04em] text-q-ink-strong [text-wrap:balance]"
            style={{ animationDelay: ".08s" }}
          >
            Le logiciel des artisans du bâtiment{" "}
            {/* Seconde voix sur sa propre ligne dès 640 px : elle ne se coupe pas après « pour » */}
            <span className="q-serif sm:block">pour vos devis et factures.</span>
          </h1>

          <div className="lp-fade-up mt-8" style={{ animationDelay: ".16s" }}>
            <CheckList items={PROMISES} />
          </div>

          <div className="lp-fade-up mt-9 w-full" style={{ animationDelay: ".24s" }}>
            <CtaButtons align="start" primary={{ href: SIGNUP_HREF, label: "Essayer gratuitement" }} />
          </div>

          {/* Label de la DGFiP : règles de la charte dans components/brand/SolutionCompatible.tsx */}
          <div
            className="lp-fade-up mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5"
            style={{ animationDelay: ".32s" }}
          >
            <SolutionCompatible priority />
            <p className="max-w-[300px] text-[14px] leading-[1.55] text-q-text-3">
              Sans carte bancaire. Vous payez à partir de votre première facture.
            </p>
          </div>
        </div>

        <HeroPhoto />
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   B — Bandeau de la facture électronique (cible de la
   pastille du héros)
───────────────────────────────────────────────────────── */
const EINVOICING_PILLS = ["Factur-X", "Mentions obligatoires", "Numérotation continue"]

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
            Solution compatible facturation électronique
          </h2>
          <p className="mt-3 max-w-[560px] text-[16px] leading-[1.6] text-q-text-3 [text-wrap:pretty]">
            Qonforme est raccordé à une plateforme agréée. Le 1er&nbsp;septembre 2027, les TPE et PME émettront leurs factures entre entreprises en électronique&nbsp;: votre logiciel suit la réforme.
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
   C — Rangée des métiers (à la place des logos de presse)
───────────────────────────────────────────────────────── */
const TRADES = [
  { label: "Électriciens", slug: "electricien", Icon: PlugZap },
  { label: "Plombiers", slug: "plombier", Icon: Droplets },
  { label: "Maçons", slug: "macon", Icon: BrickWall },
  { label: "Peintres", slug: "peintre", Icon: PaintRoller },
  { label: "Carreleurs", slug: "carreleur", Icon: Grid3x3 },
  { label: "Menuisiers", slug: "menuisier", Icon: Hammer },
  { label: "Couvreurs", slug: "couvreur", Icon: House },
]

const STAGGER = ["", "lp-d1", "lp-d2", "lp-d3"]

export function TradesStrip() {
  return (
    <section aria-labelledby="metiers-titre" className="bg-q-surface px-6 pb-[clamp(56px,7vw,88px)] pt-[clamp(16px,2vw,24px)]">
      <div className={D_WRAP}>
        <p id="metiers-titre" data-reveal="" className="text-center text-[13px] font-medium text-q-text-4">
          Pensé pour les artisans du bâtiment
        </p>
        {/* Rangées incomplètes centrées : 2 par ligne sur téléphone, 4 sur tablette, 7 sur grand écran */}
        <ul className="mt-7 flex flex-wrap justify-center gap-y-6">
          {TRADES.map(({ label, slug, Icon }, i) => (
            <li key={slug} data-reveal="" className={cn("flex w-1/2 justify-center sm:w-1/4 lg:w-auto lg:flex-1", STAGGER[i % STAGGER.length])}>
              <Link
                href={`/facturation/${slug}`}
                className="inline-flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-[-0.02em] text-q-text-4 transition-colors hover:text-q-accent-strong"
              >
                <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
