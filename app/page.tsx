import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight, ArrowRightLeft, BellRing, Check, ChevronDown, CircleCheck, CircleDashed, ClipboardList,
  Download, Eye, FileMinus, FileText, FolderOpen, Package, Palette, Percent, ReceiptText, RotateCcw,
  Send, ShieldCheck, Smartphone, Unlock, Users,
} from "lucide-react"

import { LandingHero } from "@/components/landing/LandingHero"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { StorySection } from "@/components/landing/StorySection"
import { MacBook, IPhone, SCREENS } from "@/components/landing/devices"
import { Chip, CtaButtons, Floater, PanPhoto, PhotoBand, SectionTitle } from "@/components/landing/ui"
import { StepCatalogue, StepCompany, StepQuote } from "@/components/landing/mini-ui"
import { EXAMPLES } from "@/components/landing/examples"
import Footer from "@/components/layout/Footer"
import PricingSelector from "@/components/billing/PricingSelector"
import { PLANS } from "@/lib/stripe/plans"
import { GUARANTEE_DAYS } from "@/lib/stripe/access"
import { PHOTOS, type LandingPhoto } from "@/lib/landing/photos"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"

/*
 * Accueil — canevas « Main » v20, porté le 02/10/2026.
 *
 * Règles (CLAUDE.md, DECISIONS-STRATEGIQUES.md § 2, § 6 et § 10) :
 *  - aucun avis, chiffre, client ou certification inventés ; ce qui n'existe pas
 *    encore est dit « en préparation » ou « bientôt ». Les sections du canevas
 *    sur des fonctions non livrées (situations de travaux, retenue de garantie,
 *    autoliquidation, réception, trésorerie, lien de paiement, signature en
 *    ligne, transmission par plateforme agréée) ne sont pas reprises ;
 *  - vouvoiement ; titres en deux voix (Bricolage, puis Instrument Serif
 *    italique bleu) ; couleurs par jetons --q-* (thème sombre compris) ;
 *  - captures : le vrai produit (pages de démo, données d'exemple) ;
 *  - photos : illustrations d'artisans (Pexels), jamais présentées comme des clients ;
 *  - mouvement en CSS seul (classes lp-* de app/globals.css), sans
 *    backdrop-filter, will-change ni animation infinie (règle iOS).
 */

const essentiel = PLANS.starter
const artisan = PLANS.pro
const { relance: RELANCE, payee: PAYEE, envoyee: ENVOYEE, devis: DEVIS } = EXAMPLES

/** Montant en euros sans centimes, espace insécable avant le symbole. */
const euros = (n: number) => `${n} €`

const SECTION = "px-6 py-[clamp(88px,9vw,120px)]"
const WRAP = "mx-auto w-full max-w-[1200px]"

/* ─────────────────────────────────────────────────────────
   Bandeau des métiers, sous le héros (glisse avec la page)
───────────────────────────────────────────────────────── */
const MARQUEE = [
  "Plaquistes", "Électriciens", "Plombiers", "Peintres", "Carreleurs", "Menuisiers",
  "Couvreurs", "Maçons", "Chauffagistes", "Serruriers", "Paysagistes", "Façadiers",
]

function TradeMarquee() {
  return (
    <section aria-label="Métiers du bâtiment" className="lp-marquee lp-clip bg-q-surface pb-4 pt-2">
      <div className="lp-marquee-track">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 items-center">
            {MARQUEE.map((t) => (
              <li key={t} className="flex items-center gap-3 whitespace-nowrap pr-3 font-display text-[clamp(18px,1.6vw,22px)] font-semibold tracking-[-0.02em] text-q-text-4">
                {t}
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-q-field" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   1 — La réforme, en deux dates, et où en est Qonforme
───────────────────────────────────────────────────────── */
const REFORM = [
  {
    date: "1er sept. 2026",
    text: <>Toute entreprise doit pouvoir <strong className="font-semibold text-q-ink-strong">recevoir</strong> des factures électroniques de ses fournisseurs.</>,
    pill: "En vigueur",
    tone: "bg-q-ok-bg text-q-ok",
  },
  {
    date: "1er sept. 2027",
    text: <>Les TPE et PME, donc la plupart des artisans, <strong className="font-semibold text-q-ink-strong">émettent</strong> à leur tour leurs factures entre entreprises en électronique, par une plateforme agréée.</>,
    pill: "À préparer",
    tone: "bg-q-info-bg text-q-info",
  },
]

function ReformSection() {
  return (
    <section id="reforme" className={cn("scroll-mt-16 bg-q-surface", SECTION)}>
      <div className={WRAP}>
        <SectionTitle
          eyebrow="Ce que dit la loi"
          title="Deux dates à retenir."
          accent="Voici où en est Qonforme."
          sub="La facture électronique arrive dans le bâtiment. Le calendrier est fixé ; votre logiciel suit."
        />
        <div className="lp-reveal lp-clip mt-10 grid grid-cols-1 divide-y divide-q-line rounded-[18px] border border-q-line bg-q-surface md:grid-cols-3 md:divide-x md:divide-y-0">
          {REFORM.map((r) => (
            <div key={r.date} className="flex flex-col gap-3 p-6 sm:p-7">
              <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-q-ink-strong">{r.date}</p>
              <p className="text-[15px] leading-[1.6] text-q-text-3">{r.text}</p>
              <span className={cn("mt-auto inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[12px] font-semibold", r.tone)}>{r.pill}</span>
            </div>
          ))}
          <div className="flex flex-col gap-3 bg-q-surface-2 p-6 sm:p-7">
            <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-q-ink-strong">Où en est Qonforme</p>
            <ul className="flex flex-col gap-2.5 text-[15px] leading-[1.55] text-q-text-3">
              <li className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-q-accent" strokeWidth={2} aria-hidden />
                Devis et factures avec les mentions obligatoires, numérotés à la suite.
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-q-accent" strokeWidth={2} aria-hidden />
                Une facture envoyée ne se modifie plus&nbsp;: une erreur se corrige par un avoir.
              </li>
              <li className="flex gap-2.5">
                <CircleDashed className="mt-1 h-4 w-4 shrink-0 text-q-text-4" strokeWidth={2} aria-hidden />
                <span>
                  Envoi et réception par une plateforme agréée, depuis Qonforme&nbsp;:{" "}
                  <strong className="font-semibold text-q-ink-strong">en préparation</strong>.
                </span>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-[12.5px] text-q-text-4">Calendrier officiel de la réforme, publié par l&apos;administration fiscale.</p>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   2 — Les trois profils (DECISIONS § 4)
───────────────────────────────────────────────────────── */
const PROFILES: {
  kicker: string
  title: string
  items: string[]
  /** Fonctions annoncées, pas encore livrées : affichées « à venir ». */
  upcoming?: boolean
  pill: string
  pillTone: string
  photo: LandingPhoto | null
  position?: string
}[] = [
  {
    kicker: "Vous démarrez",
    title: "Un devis professionnel dès votre premier chantier.",
    items: [
      "Votre entreprise remplie depuis son numéro SIREN",
      "Vos prestations et vos prix dans un catalogue",
      "Mentions prêtes à l'emploi : franchise de TVA, décennale",
    ],
    pill: "Devis gratuits",
    pillTone: "bg-q-ok-bg text-q-ok",
    photo: PHOTOS.nouvelInstalle,
  },
  {
    kicker: "Vous facturez chaque semaine",
    title: "Être payé à l'heure, sans courir après personne.",
    items: [
      "Devis transformé en facture en un clic",
      "Facture envoyée par email, avec votre IBAN",
      "Relances automatiques 30 et 45 jours après l'échéance",
    ],
    pill: `${essentiel.name} · ${euros(essentiel.monthlyPrice)} HT/mois`,
    pillTone: "bg-q-info-bg text-q-info",
    photo: PHOTOS.sansLogiciel,
    position: "50% 0%",
  },
  {
    kicker: "Votre entreprise grandit",
    title: "Les chantiers longs, sans changer d'outil.",
    // Fonctions livrées ; la formule n'est vendue qu'une fois ses prix configurés
    items: artisan.features,
    pill: artisan.available ? `${artisan.name} · ${euros(artisan.monthlyPrice)} HT/mois` : `${artisan.name} · bientôt en vente`,
    pillTone: "bg-q-ink-strong text-q-surface",
    photo: PHOTOS.entrepriseGrandit,
  },
]

function ProfilesSection() {
  return (
    <section className={cn("bg-q-surface", SECTION)}>
      <div className={WRAP}>
        <SectionTitle
          title="Votre premier logiciel de facturation."
          accent="Et le dernier."
          sub="Commencez simple. Quand votre entreprise grandit, vos clients, vos devis et votre historique vous suivent, sans rien ressaisir."
        />
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PROFILES.map((p, i) => (
            <article
              key={p.kicker}
              className={cn("lp-reveal lp-card-scope lp-zoom-host lp-clip relative flex flex-col rounded-[22px] border border-q-line bg-q-surface", i === 1 && "lp-d1", i === 2 && "lp-d2")}
            >
              <span aria-hidden className="lp-fill absolute left-0 top-0 z-[1] h-[3px] bg-q-accent" style={{ width: `${((i + 1) / PROFILES.length) * 100}%` }} />
              {p.photo && (
                <div className="lp-clip relative aspect-[4/3] bg-q-sunken">
                  <Image
                    src={p.photo.src}
                    alt={p.photo.alt}
                    fill
                    sizes="(min-width: 768px) 380px, 100vw"
                    loading="lazy"
                    className="lp-zoom object-cover"
                    style={p.position ? { objectPosition: p.position } : undefined}
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3.5 p-6 sm:p-7">
                <p className="flex items-center gap-2.5 text-[13px] font-semibold text-q-text-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-q-ink-strong text-[12px] text-q-surface">{i + 1}</span>
                  {p.kicker}
                </p>
                <h3 className="font-display text-[21px] font-semibold leading-[1.2] tracking-[-0.025em] text-q-ink-strong [text-wrap:balance]">{p.title}</h3>
                {p.upcoming && <p className="text-[13px] font-semibold text-q-text-4">À venir avec la formule {artisan.name}&nbsp;:</p>}
                <ul className="flex flex-col gap-2.5 text-[15px] leading-[1.5] text-q-text-2">
                  {p.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      {p.upcoming ? (
                        <CircleDashed className="mt-[3px] h-4 w-4 shrink-0 text-q-text-4" strokeWidth={2} aria-hidden />
                      ) : (
                        <Check className="mt-[3px] h-4 w-4 shrink-0 text-q-accent" strokeWidth={2} aria-hidden />
                      )}
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-auto pt-2">
                  <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-[12.5px] font-semibold", p.pillTone)}>{p.pill}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   3 — Le devis, sur l'ordinateur
───────────────────────────────────────────────────────── */
function QuoteSection() {
  return (
    <section className={cn("lp-clip bg-q-surface", SECTION)}>
      <div className={WRAP}>
        <SectionTitle
          align="center"
          title="Le devis se fait sur le chantier."
          accent="La facture suit d'elle-même."
          sub="Vos prestations sont prêtes dans le catalogue, la TVA se choisit ligne par ligne et l'aperçu PDF est à un clic. Une fois accepté, le devis devient facture en un clic."
        />
        <div className="relative mx-auto mt-12 max-w-[1040px] sm:mt-14">
          <div className="lp-zoomin hidden sm:block">
            <MacBook screen={{ ...SCREENS.devis, sizes: "(min-width: 1088px) 1040px, 92vw" }} />
          </div>
          <div className="lp-reveal mx-auto w-[min(300px,72%)] sm:hidden">
            <IPhone screen={{ ...SCREENS.mobileDevis, sizes: "300px" }} />
          </div>
          {/* Puces : seulement quand elles tiennent hors de l'écran de l'ordinateur */}
          <div aria-hidden className="absolute left-[-96px] top-[16%] z-[5] hidden xl:block">
            <Chip icon={Package} label="Vos prestations" bob={1} />
          </div>
          <div aria-hidden className="absolute left-[-72px] top-[52%] z-[5] hidden xl:block">
            <Chip icon={Percent} label="TVA par ligne" bob={2} />
          </div>
          <div aria-hidden className="absolute right-[-96px] top-[18%] z-[5] hidden xl:block">
            <Chip icon={Eye} label="Aperçu PDF" bob={3} />
          </div>
          <div aria-hidden className="absolute right-[-64px] top-[58%] z-[5] hidden xl:block">
            <Chip icon={ShieldCheck} label="Mention décennale" bob={1} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   4 — Manifeste : les mots s'encrent au défilement
───────────────────────────────────────────────────────── */
const MANIFESTO = "Vous êtes artisan, pas comptable. Vos devis partent du chantier, vos factures suivent et vos relances partent sans vous."
const MANIFESTO_ACCENT = "Le soir, l'essentiel est déjà prêt."

function ManifestoSection() {
  const words = MANIFESTO.split(" ")
  const accent = MANIFESTO_ACCENT.split(" ")
  const total = words.length + accent.length
  // Chaque mot s'encre sur 30 % de l'entrée à l'écran, décalé d'un cran sur le précédent.
  const range = (i: number) => {
    const a = Math.round((i / total) * 62)
    return { "--lp-a": `${a}%`, "--lp-b": `${a + 30}%` } as React.CSSProperties
  }
  return (
    <section className="bg-q-surface px-6 py-[clamp(88px,11vw,150px)]">
      <p className="lp-ink-scope mx-auto max-w-[860px] text-center font-display text-[clamp(30px,4vw,48px)] font-semibold leading-[1.14] tracking-[-0.03em] text-q-ink-strong [text-wrap:balance]">
        {words.map((w, i) => (
          <span key={i}>
            <span className="lp-w" style={range(i)}>{w}</span>{" "}
          </span>
        ))}
        {accent.map((w, i) => (
          <span key={`a${i}`}>
            <span className="lp-wb text-q-accent" style={range(words.length + i)}>{w}</span>
            {i < accent.length - 1 && " "}
          </span>
        ))}
      </p>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   5 — Sur le téléphone (site installable, pas d'app native)
───────────────────────────────────────────────────────── */
const MOBILE_CHIPS = ["Devis sur place", "Facture en deux gestes", "Rien à télécharger"]

function MobileSection() {
  const photo = PHOTOS.atelierTelephone
  return (
    <section className={cn("q-on-ink lp-clip bg-[#0A1122]", SECTION)}>
      <div className={cn(WRAP, "grid grid-cols-1 items-center gap-14 lg:grid-cols-2")}>
        <div>
          <SectionTitle
            tone="dark"
            title="Le chantier dans une main,"
            accent="Qonforme dans l'autre."
            sub="Un devis chiffré devant le client, une facture envoyée avant de remonter dans le camion. Qonforme s'ouvre dans le navigateur et s'ajoute à l'écran d'accueil de votre téléphone, sans passer par un store."
          />
          <ul className="lp-reveal mt-7 flex flex-wrap gap-2.5">
            {MOBILE_CHIPS.map((c) => (
              <li key={c} className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3.5 text-[13.5px] font-medium text-[#D5DBE5]">
                <Check className="h-3.5 w-3.5 text-[#7FA6FF]" strokeWidth={2.25} aria-hidden />
                {c}
              </li>
            ))}
          </ul>
          {photo && (
            <div className="lp-reveal lp-clip relative mt-10 aspect-[16/10] max-w-[480px] rounded-[20px] bg-[#1B2333]">
              <PanPhoto photo={photo} sizes="(min-width: 1024px) 480px, 90vw" />
            </div>
          )}
        </div>

        <div className="relative mx-auto flex w-full max-w-[560px] items-start justify-center gap-[4%]">
          <div className="lp-drift-v mt-[26%] hidden w-[30%] sm:block">
            <IPhone screen={{ ...SCREENS.mobileDevis, sizes: "(min-width: 1024px) 170px, 30vw" }} />
          </div>
          <div className="mt-[10%] w-[64%] sm:w-[34%]">
            <IPhone screen={{ ...SCREENS.mobileFacture, sizes: "(min-width: 1024px) 190px, (min-width: 640px) 34vw, 64vw" }} />
          </div>
          <div className="lp-drift-v hidden w-[30%] sm:block">
            <IPhone screen={{ ...SCREENS.mobileTableauDeBord, sizes: "(min-width: 1024px) 170px, 30vw" }} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   6 — Payé à l'heure : envoi, relances, paiement
   (relances du cron J+30 / J+45, bouton « Relancer » ; avec Essentiel)
───────────────────────────────────────────────────────── */
const PAID_STEPS = [
  { tag: "Envoi", title: "La facture part par email", text: "En PDF, avec votre IBAN dans le message et la date d'échéance." },
  { tag: "J+30", title: "Première relance, sans vous", text: "Un rappel part à votre client 30 jours après l'échéance." },
  { tag: "J+45", title: "Seconde relance", text: "Si la facture n'est toujours pas réglée, 45 jours après l'échéance." },
  { tag: "Payée", title: "Les relances s'arrêtent", text: "Dès que vous marquez la facture comme payée." },
]

function PaidSection() {
  return (
    <section className={cn("lp-clip bg-q-surface", SECTION)}>
      <div className={cn(WRAP, "grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20")}>
        <div className="relative mx-auto w-full max-w-[460px] py-6">
          <div aria-hidden className="absolute inset-x-0 bottom-0 top-[14%] rounded-[28px] border border-q-line bg-q-bg" />
          <IPhone className="lp-reveal relative z-[2] mx-auto w-[min(260px,62%)]" screen={{ ...SCREENS.mobileFacture, sizes: "260px" }} />
          <div aria-hidden className="absolute right-[-4%] top-[6%] z-[5] hidden sm:block">
            <Floater icon={BellRing} tone="warn" title="Relance envoyée" sub={`${RELANCE.client.name} · ${RELANCE.invoice_number}`} bob={2} />
          </div>
          <div aria-hidden className="absolute bottom-[6%] left-[-6%] z-[5] hidden sm:block">
            <Floater icon={CircleCheck} tone="ok" title={`Facture ${PAYEE.invoice_number} payée`} sub={`${PAYEE.client.name} · ${formatCurrency(PAYEE.total_ttc)}`} bob={3} />
          </div>
        </div>

        <div>
          <SectionTitle
            title="Payé à l'heure,"
            accent="sans relancer à la main."
            sub="Chaque facture part par email avec votre IBAN. Si le virement tarde, Qonforme relance votre client à votre place."
          />
          <ol className="mt-8 border-b border-q-line">
            {PAID_STEPS.map((s, i) => (
              <li key={s.tag} className={cn("lp-reveal grid grid-cols-[64px_minmax(0,1fr)] gap-4 border-t border-q-line py-4 sm:grid-cols-[72px_minmax(0,1fr)]", i % 2 === 1 && "lp-d1")}>
                <span className="pt-0.5 font-mono text-[13px] font-medium text-q-accent-strong">{s.tag}</span>
                <span className="flex flex-col gap-1">
                  <span className="text-[16px] font-semibold text-q-ink-strong">{s.title}</span>
                  <span className="text-[14.5px] leading-[1.55] text-q-text-3">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[14px] leading-[1.6] text-q-text-4">
            Besoin de relancer plus tôt&nbsp;? Le bouton «&nbsp;Relancer&nbsp;» de la facture envoie un rappel quand vous le décidez.
            Envoi et relances avec la formule {essentiel.name}.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   7 — Galerie des métiers (deux rangées qui glissent en sens contraire)
───────────────────────────────────────────────────────── */
const GALLERY_TRADES: { photo: LandingPhoto | null; label: string; slug: string }[] = [
  { photo: PHOTOS.plaquiste, label: "Plaquiste", slug: "plaquiste" },
  { photo: PHOTOS.sansLogiciel, label: "Électricien", slug: "electricien" },
  { photo: PHOTOS.plombier, label: "Plombier", slug: "plombier" },
  { photo: PHOTOS.carreleur, label: "Carreleur", slug: "carreleur" },
  { photo: PHOTOS.menuisier, label: "Menuisier", slug: "menuisier" },
  { photo: PHOTOS.couvreur, label: "Couvreur", slug: "couvreur" },
  { photo: PHOTOS.macon, label: "Maçon", slug: "macon" },
  { photo: PHOTOS.chauffagiste, label: "Chauffagiste", slug: "chauffagiste" },
]

const GALLERY_SCENES: { photo: LandingPhoto | null; label: string }[] = [
  { photo: PHOTOS.chezLeClient, label: "Chez le client" },
  { photo: PHOTOS.nouvelInstalle, label: "À l'atelier" },
  { photo: PHOTOS.entrepriseGrandit, label: "En équipe" },
  { photo: PHOTOS.chantier, label: "En rénovation" },
  { photo: PHOTOS.finDeJournee, label: "Départ du matin" },
  { photo: PHOTOS.cheffeDeChantier, label: "Sur le chantier" },
  { photo: PHOTOS.appelFinal, label: "Finitions" },
]

const TILE = "lp-clip relative block aspect-[4/5] w-[clamp(150px,15vw,208px)] shrink-0 rounded-[18px] bg-q-sunken"

function TileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute bottom-3 left-3 rounded-full bg-q-surface px-2.5 py-1 text-[12.5px] font-semibold text-q-ink-strong shadow-[0_1px_2px_rgba(10,17,34,.08)]">
      {children}
    </span>
  )
}

function TradesSection() {
  return (
    <section className="lp-clip bg-q-surface py-[clamp(88px,9vw,120px)]">
      <div className={cn(WRAP, "px-6")}>
        <SectionTitle
          title="Plaquistes, électriciens, plombiers…"
          accent="un seul logiciel pour tous."
          sub="Vos prestations, vos unités et vos mentions. Le reste ne change pas : devis, factures, relances."
        />
      </div>
      <div className="mt-12 flex flex-col gap-3">
        <ul className="lp-rail-l flex w-max gap-3 pl-6">
          {GALLERY_TRADES.map((t) =>
            t.photo ? (
              <li key={t.slug}>
                <Link href={`/facturation/${t.slug}`} className={cn(TILE, "group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-accent")}>
                  <Image src={t.photo.src} alt={t.photo.alt} fill sizes="208px" loading="lazy" className="object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none" />
                  <TileLabel>{t.label}</TileLabel>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
        <ul className="lp-rail-r flex w-max gap-3 pl-6" aria-label="Scènes de chantier">
          {GALLERY_SCENES.map((s) =>
            s.photo ? (
              <li key={s.label} className={TILE}>
                <Image src={s.photo.src} alt={s.photo.alt} fill sizes="208px" loading="lazy" className="object-cover" />
                <TileLabel>{s.label}</TileLabel>
              </li>
            ) : null,
          )}
        </ul>
      </div>
      <p className={cn(WRAP, "mt-8 px-6")}>
        <Link href="/facturation" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-q-accent-strong hover:underline">
          Tous les métiers <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </Link>
      </p>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   8 — Démarrage en trois étapes
───────────────────────────────────────────────────────── */
const STEPS = [
  { title: "Votre SIREN", text: "Le nom, l'adresse et le numéro de TVA de votre entreprise se remplissent seuls.", ui: <StepCompany /> },
  { title: "Vos prestations", text: "Votre catalogue, avec vos unités et vos prix, prêt pour tous vos devis.", ui: <StepCatalogue /> },
  { title: "Votre premier devis", text: "Envoyé par email, gratuit, sans carte bancaire.", ui: <StepQuote /> },
]

function StepsSection() {
  return (
    <section className={cn("bg-q-surface", SECTION)}>
      <div className={WRAP}>
        <SectionTitle title="Trois étapes," accent="et votre premier devis est parti." />
        <ol className="lp-steps-scope mt-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className={cn("lp-reveal flex min-w-0 flex-col", i === 1 && "lp-d1", i === 2 && "lp-d2")}>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-q-ink-strong text-[14px] font-semibold text-q-surface">{i + 1}</span>
                <span aria-hidden className="lp-line-x h-px flex-1 bg-q-accent" />
              </div>
              <h3 className="mt-5 text-[18px] font-semibold text-q-ink-strong">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-[1.55] text-q-text-3">{s.text}</p>
              <div className="mt-5">{s.ui}</div>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex justify-center">
          <Link href="/signup" className="lp-btn-p">
            Créer mon premier devis
            <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   9 — Ce qui est inclus (uniquement ce qui existe)
───────────────────────────────────────────────────────── */
const INCLUDED = [
  { icon: FileText, title: "Devis illimités", text: "Gratuits, même sans formule." },
  { icon: ReceiptText, title: "Factures", text: "Mentions obligatoires, TVA par ligne." },
  { icon: ArrowRightLeft, title: "Devis en facture", text: "En un clic, sans ressaisie." },
  { icon: Users, title: "Clients", text: "Fiches réutilisables, SIREN contrôlé." },
  { icon: Package, title: "Catalogue", text: "Vos prestations et vos prix." },
  { icon: Send, title: "Envoi par email", text: "PDF joint, IBAN dans le message." },
  { icon: BellRing, title: "Relances automatiques", text: "30 et 45 jours après l'échéance." },
  { icon: FileMinus, title: "Avoirs", text: "Pour corriger une facture émise." },
  { icon: ClipboardList, title: "Bons de commande", text: "Quand votre client en demande un." },
  { icon: Download, title: "Export FEC", text: "Prêt pour votre comptable." },
  { icon: Palette, title: "Votre logo, votre couleur", text: "Sur chaque devis et facture." },
  { icon: Smartphone, title: "Sur téléphone", text: "Installable sur l'écran d'accueil." },
]

function IncludedSection() {
  return (
    <section className={cn("border-t border-q-line bg-q-surface", SECTION)}>
      <div className={WRAP}>
        <SectionTitle title="Tout ce qu'il faut." accent="Rien de superflu." />
        <ul className="mt-12 grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-8 lg:grid-cols-4">
          {INCLUDED.map((f, i) => (
            <li key={f.title} className={cn("lp-reveal flex flex-col gap-3 border-t border-q-line pt-5", i % 4 === 1 && "lp-d1", i % 4 >= 2 && "lp-d2")}>
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-q-wash text-q-accent-strong">
                <f.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-semibold leading-snug text-q-ink-strong sm:text-[16px]">{f.title}</span>
                <span className="mt-1 block text-[14px] leading-[1.55] text-q-text-3 sm:text-[15px]">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   10 — Tarifs (grille partagée avec /pricing : lib/stripe/plans.ts)
───────────────────────────────────────────────────────── */
function PricingSection() {
  return (
    <section id="pricing" className={cn("scroll-mt-16 border-y border-q-line bg-q-bg", SECTION)}>
      <div className="mx-auto w-full max-w-[1080px]">
        <SectionTitle
          align="center"
          title="Vos devis sont gratuits."
          accent="Vous payez quand vous facturez."
          sub={`Sans carte bancaire pour commencer. La formule se choisit au moment d'envoyer votre première facture, satisfait ou remboursé pendant ${GUARANTEE_DAYS} jours.`}
          className="mb-12"
        />
        <div className="lp-reveal">
          <PricingSelector />
        </div>
        <div className="mt-10 flex justify-center">
          <Link href="/pricing" className="lp-btn-s">
            <span className="lp-btn-s-ic" aria-hidden>
              <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2} />
            </span>
            Comparer les offres
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   11 — Engagements (à la place des avis du canevas : aucun avis inventé)
───────────────────────────────────────────────────────── */
const COMMITMENTS = [
  {
    icon: FolderOpen,
    title: "Vos documents restent à vous",
    text: "Consultation, téléchargement et export, avec ou sans formule, même après une résiliation.",
  },
  {
    icon: RotateCcw,
    title: `Satisfait ou remboursé ${GUARANTEE_DAYS} jours`,
    text: "Le remboursement se demande depuis vos paramètres, sans justification, une fois par compte.",
  },
  {
    icon: Unlock,
    title: "Sans engagement",
    text: "La résiliation se fait depuis vos paramètres, sans frais, à tout moment.",
  },
]

function CommitmentsSection() {
  return (
    <section className={cn("bg-q-surface", SECTION)}>
      <div className={WRAP}>
        <SectionTitle title="Nos engagements," accent="noir sur blanc." />
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {COMMITMENTS.map((c, i) => (
            <article
              key={c.title}
              className={cn(
                "lp-reveal flex flex-col gap-3 rounded-[22px] border p-7",
                i === 2 ? "q-on-ink border-[#0A1122] bg-[#0A1122]" : "border-q-line bg-q-surface",
                i === 1 && "lp-d1",
                i === 2 && "lp-d2",
              )}
            >
              <span className={cn("grid h-10 w-10 place-items-center rounded-[12px]", i === 2 ? "bg-white/10 text-[#7FA6FF]" : "bg-q-wash text-q-accent-strong")}>
                <c.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className={cn("font-display text-[20px] font-semibold tracking-[-0.02em]", i === 2 ? "text-white" : "text-q-ink-strong")}>{c.title}</h3>
              <p className={cn("text-[15px] leading-[1.6]", i === 2 ? "text-[#AFBDD3]" : "text-q-text-3")}>{c.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   12 — Questions fréquentes (reprises telles quelles dans le JSON-LD)
───────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Qonforme est-il gratuit ?",
    a: `Les devis, les clients, le catalogue et les factures en brouillon sont gratuits, sans limite de durée. Une formule n'est demandée qu'au moment d'envoyer une facture : ${essentiel.name}, ${essentiel.monthlyPrice} € HT par mois ou ${essentiel.yearlyPrice} € HT par an.`,
  },
  {
    q: "Que change la facture électronique pour un artisan ?",
    a: "Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques. À partir du 1er septembre 2027, les TPE et PME doivent aussi émettre leurs factures entre entreprises en électronique, par une plateforme agréée. Pour les ventes aux particuliers, seules certaines données sont transmises à l'administration.",
  },
  {
    q: "Qonforme est-il une plateforme agréée ?",
    a: "Non. Qonforme est un logiciel de facturation. Le raccordement à une plateforme agréée, pour envoyer et recevoir vos factures électroniques depuis Qonforme, est en préparation.",
  },
  {
    q: "Je suis en franchise de TVA. Est-ce prévu ?",
    a: "Oui. La mention « TVA non applicable, art. 293 B du CGI » s'ajoute à vos documents depuis Paramètres, à partir d'un modèle prêt à l'emploi.",
  },
  {
    q: "Mon client est un particulier, sans SIREN. Est-ce un problème ?",
    a: "Non. Un client particulier se crée sans SIREN, et ses devis et factures se font comme les autres.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: `Oui, sans engagement ni frais, depuis vos paramètres. Vos documents restent consultables, téléchargeables et exportables après la résiliation. Et si Qonforme ne vous convient pas, vous êtes remboursé dans les ${GUARANTEE_DAYS} jours.`,
  },
  {
    q: "Faut-il installer une application ?",
    a: "Non. Qonforme fonctionne dans le navigateur, sur ordinateur comme sur téléphone. Sur téléphone, vous pouvez l'ajouter à l'écran d'accueil pour l'ouvrir comme une application.",
  },
]

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
}

/** Typographie française à l'affichage : espace insécable avant « ? » et « : ». */
const fr = (s: string) => s.replace(/ ([?:;!])/g, " $1")

function FAQSection() {
  return (
    <section className={cn("bg-q-surface", SECTION)}>
      <div className="mx-auto w-full max-w-[800px]">
        <SectionTitle title="Questions" accent="fréquentes" className="mb-10" />
        <div className="lp-reveal border-b border-q-line">
          {FAQ_ITEMS.map((item, i) => (
            // <details> natif : s'ouvre au clavier et sans JavaScript ; la première réponse est ouverte.
            <details key={item.q} open={i === 0} className="group border-t border-q-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-[16px] font-semibold text-q-ink-strong">{fr(item.q)}</span>
                <ChevronDown className="h-[18px] w-[18px] shrink-0 text-q-text-4 transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none" strokeWidth={1.75} aria-hidden />
              </summary>
              <p className="max-w-[680px] pb-6 text-[15px] leading-[1.65] text-q-text-3">{fr(item.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   13 — Métiers et ressources (maillage interne pSEO)
───────────────────────────────────────────────────────── */
const TRADES = [
  { slug: "plombier", nom: "Plombier" },
  { slug: "electricien", nom: "Électricien" },
  { slug: "macon", nom: "Maçon" },
  { slug: "peintre", nom: "Peintre en bâtiment" },
  { slug: "carreleur", nom: "Carreleur" },
  { slug: "menuisier", nom: "Menuisier" },
  { slug: "couvreur", nom: "Couvreur" },
  { slug: "plaquiste", nom: "Plaquiste" },
  { slug: "chauffagiste", nom: "Chauffagiste" },
  { slug: "serrurier", nom: "Serrurier" },
  { slug: "paysagiste", nom: "Paysagiste" },
]

const GUIDES = [
  { href: "/guide/comment-faire-un-devis", label: "Comment faire un devis" },
  { href: "/guide/premiere-facture", label: "Comment faire une facture" },
  { href: "/guide/tva-travaux", label: "TVA des travaux : 20, 10 ou 5,5 %" },
  { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires sur une facture" },
  { href: "/guide/facture-electronique-2026", label: "La facture électronique" },
  { href: "/guide/plateforme-agreee", label: "Choisir sa plateforme agréée" },
  { href: "/guide", label: "Tous les guides" },
]

const TEMPLATES = [
  { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
  { href: "/modele/facture-classique", label: "Modèle de facture" },
  { href: "/modele/facture-auto-entrepreneur", label: "Modèle de facture auto-entrepreneur" },
  { href: "/modele", label: "Tous les modèles" },
]

const TOOLS = [
  { href: "/outils/calculateur-tva", label: "Calculateur de TVA" },
  { href: "/outils/verification-siret", label: "Vérification de SIRET" },
  { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis" },
  { href: "/outils", label: "Tous les outils gratuits" },
]

function ResourcesSection() {
  const columns = [
    { title: "Guides", links: GUIDES },
    { title: "Modèles gratuits", links: TEMPLATES },
    { title: "Outils gratuits", links: TOOLS },
  ]
  return (
    <section className={cn("border-t border-q-line bg-q-bg", SECTION)}>
      <div className={WRAP}>
        <SectionTitle title="Pour aller plus loin," accent="gratuitement." />
        <div className="mt-10">
          <p className="text-[15px] font-semibold text-q-ink-strong">Facturation par métier</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {TRADES.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/facturation/${t.slug}`}
                  className="inline-flex h-10 items-center rounded-full border border-q-line bg-q-surface px-4 text-[14px] font-medium text-q-ink-strong transition-colors hover:border-q-wash-line hover:text-q-accent-strong"
                >
                  {t.nom}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/facturation" className="inline-flex h-10 items-center gap-1.5 px-2 text-[14px] font-semibold text-q-accent-strong hover:underline">
                Tous les métiers <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </Link>
            </li>
          </ul>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[15px] font-semibold text-q-ink-strong">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[15px] text-q-text-3 transition-colors hover:text-q-accent-strong">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   14 — Appel final : texte sur fond clair, photo à droite
───────────────────────────────────────────────────────── */
function FinalCta() {
  const photo = PHOTOS.appelFinal
  return (
    <section className="bg-q-surface px-6 py-[clamp(72px,8vw,104px)]">
      <div className={cn(WRAP, "lp-reveal lp-clip grid grid-cols-1 rounded-[28px] border border-q-line md:grid-cols-2")}>
        <div className="flex flex-col items-start bg-q-bg px-6 py-12 sm:px-12 sm:py-16">
          <SectionTitle title="Votre premier devis" accent="en quelques minutes." sub="Gratuit, sans carte bancaire. Vous ne payez qu'à partir de votre première facture." />
          <CtaButtons align="start" className="mt-9" />
        </div>
        {photo && (
          <div className="relative min-h-[320px] bg-q-sunken">
            <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 768px) 600px, 100vw" loading="lazy" className="object-cover" />
            <div aria-hidden className="absolute left-4 top-4 z-[2] sm:left-5 sm:top-5">
              <Floater icon={Check} tone="ok" title="Devis envoyé" sub={`${DEVIS.client.name} · ${formatCurrency(DEVIS.subtotal_ht)} HT`} bob={1} />
            </div>
            <div aria-hidden className="absolute bottom-4 right-4 z-[2] hidden sm:bottom-5 sm:right-5 sm:block">
              <Floater icon={ShieldCheck} tone="info" title="Mentions obligatoires" sub="SIREN, TVA, durée de validité" bob={2} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-q-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />
      {/* Progression de la lecture (CSS seul, masquée sans support ou avec « Réduire les animations ») */}
      <span aria-hidden className="lp-progress" />
      <PublicHeader isLandingPage />
      <main>
        <LandingHero />
        <TradeMarquee />
        <ReformSection />
        {PHOTOS.chantier && (
          <PhotoBand
            photo={PHOTOS.chantier}
            label="Pour ceux qui facturent le soir"
            title="Pour ceux qui facturent le soir,"
            accent="après le chantier."
            floater={<Floater icon={Send} tone="info" title={`Facture ${ENVOYEE.invoice_number} envoyée`} sub={`${ENVOYEE.client.name} · 21:47`} bob={1} />}
          />
        )}
        <ProfilesSection />
        <QuoteSection />
        <ManifestoSection />
        <MobileSection />
        <StorySection />
        <PaidSection />
        {PHOTOS.finDeJournee && (
          <PhotoBand
            photo={PHOTOS.finDeJournee}
            label="Le camion se range"
            title="Le camion se range."
            accent="Les relances partent sans vous."
            stack
            floater={<Floater icon={BellRing} tone="warn" title="Relance envoyée" sub={`${RELANCE.invoice_number} · ${formatCurrency(RELANCE.total_ttc)}`} bob={2} />}
          />
        )}
        <TradesSection />
        <StepsSection />
        <IncludedSection />
        <PricingSection />
        <CommitmentsSection />
        <FAQSection />
        <ResourcesSection />
        <FinalCta />
      </main>
      <Footer showCta={false} />
    </div>
  )
}
