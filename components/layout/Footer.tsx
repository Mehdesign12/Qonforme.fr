import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Check, Linkedin, Mail, Monitor } from "lucide-react"
import { LOGO_LONG_LIGHT } from "@/lib/brand"

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/#features" },
      { label: "Tarifs", href: "/pricing" },
      { label: "Démo interactive", href: "/demo" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Réforme 2027", href: "/guide/facture-electronique-2026" },
      { label: "Facturation par métier", href: "/facturation" },
      { label: "Guides pratiques", href: "/guide" },
      { label: "Modèles gratuits", href: "/modele" },
      { label: "Glossaire", href: "/glossaire" },
    ],
  },
  {
    title: "Outils",
    links: [
      { label: "Tous les outils gratuits", href: "/outils" },
      { label: "Calculateur TVA", href: "/outils/calculateur-tva" },
      { label: "Générateur de devis", href: "/outils/generateur-devis-gratuit" },
      { label: "Générateur de facture", href: "/outils/generateur-facture-gratuite" },
      { label: "Vérificateur SIRET", href: "/outils/verification-siret" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "CGU", href: "/cgu" },
      { label: "Confidentialité", href: "/confidentialite" },
    ],
  },
]

/** Engagements vérifiables (CGU, art. 4) : rien d'autre ne s'affiche ici. */
const PROMISES = [
  "Devis gratuits et illimités",
  "Sans carte bancaire pour commencer",
  "Satisfait ou remboursé pendant 30 jours",
  "Sans engagement, résiliable à tout moment",
  "Vos documents restent accessibles, même sans formule",
]

/**
 * Pied de page public, d'après le canevas « Main » : bandeau encre, marque à
 * gauche, colonnes Produit, Ressources, Outils et Légal.
 *
 * `showCta={false}` sur les pages qui ont déjà leur propre appel à l'action
 * juste au-dessus (accueil). Sinon, l'appel final du canevas (« Votre premier
 * devis… ») s'affiche sur fond clair avant le bandeau.
 */
export default function Footer({ showCta = true }: { showCta?: boolean } = {}) {
  return (
    <>
      {showCta && (
        <section aria-labelledby="footer-cta-title" className="bg-q-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-[1200px] items-center gap-8 overflow-clip rounded-[28px] border border-q-line bg-q-bg p-7 sm:p-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:p-[72px]">
            <div className="flex flex-col items-start gap-[18px]">
              <h2
                id="footer-cta-title"
                className="font-display text-[clamp(32px,4vw,52px)] font-semibold leading-[1.05] tracking-[-0.035em] text-q-ink [text-wrap:balance]"
              >
                Votre premier devis, <span className="q-serif">gratuit, en quelques minutes.</span>
              </h2>
              <p className="max-w-[440px] text-[17px] leading-[1.55] text-q-text-3 sm:text-lg">
                Sans carte bancaire. Vous ne payez qu&apos;à partir de votre première facture.
              </p>
              <div className="mt-3 flex w-full max-w-[360px] flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap">
                <Link href="/signup" className="lp-btn-p">
                  Créer mon premier devis
                  <ArrowRight className="lp-btn-arrow h-[18px] w-[18px]" aria-hidden />
                </Link>
                <Link href="/demo" className="lp-btn-s">
                  <span className="lp-btn-s-ic" aria-hidden>
                    <Monitor className="h-[15px] w-[15px]" />
                  </span>
                  Voir la démo
                </Link>
              </div>
            </div>

            <div className="q-card p-6 sm:p-7">
              <p className="q-eyebrow">Nos engagements</p>
              <ul className="mt-4 flex flex-col gap-3">
                {PROMISES.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-q-text-2">
                    <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-q-wash text-q-accent-strong">
                      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-white/[0.08] bg-[#0A1122] px-4 pb-10 text-[#94A3B8] sm:px-6">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-10 pt-12 text-sm sm:grid-cols-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] lg:gap-8">
          {/* Marque */}
          <div className="col-span-2 flex flex-col gap-3.5 sm:col-span-3 lg:col-span-1">
            <Link href="/" aria-label="Qonforme, accueil" className="self-start rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7FA6FF]">
              <Image src={LOGO_LONG_LIGHT} alt="Qonforme" width={94} height={18} sizes="94px" loading="lazy" className="h-[18px] w-auto" />
            </Link>
            <p className="max-w-[300px] leading-[1.6]">Le logiciel de devis et de facturation des artisans du bâtiment.</p>
            <div className="mt-1 flex items-center gap-2">
              <a
                href="https://www.linkedin.com/company/qonforme"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Qonforme sur LinkedIn"
                className="grid h-9 w-9 place-items-center rounded-[10px] border border-white/10 text-[#94A3B8] transition-colors hover:border-white/20 hover:text-white"
              >
                <Linkedin className="h-4 w-4" aria-hidden />
              </a>
              <a
                href="mailto:contact@qonforme.fr"
                className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/10 px-3 text-[13px] text-[#94A3B8] transition-colors hover:border-white/20 hover:text-white"
              >
                <Mail className="h-4 w-4" aria-hidden />
                contact@qonforme.fr
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-1">
              <p className="mb-1.5 font-semibold text-[#E2E8F0]">{col.title}</p>
              <ul className="flex flex-col">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-block py-1.5 text-[#94A3B8] transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-[1200px] flex-col gap-2 border-t border-white/[0.08] pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Qonforme SAS · Devis et factures des artisans du bâtiment.</p>
          <p>Vos devis sont gratuits&nbsp;: vous payez quand vous facturez.</p>
        </div>
      </footer>
    </>
  )
}
