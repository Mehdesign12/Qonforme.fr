import Link from "next/link"
import { ArrowRight, Calculator, Grid3x3, Ruler } from "lucide-react"

import { Doodles } from "@/components/brand/Doodles"
import { D_SECTION, D_WRAP } from "@/components/home/kit"
import { SectionTitle } from "@/components/landing/ui"
import { cn } from "@/lib/utils"

/**
 * « Pour aller plus loin » : liens vers les 11 pages métier, les guides, les
 * modèles et les outils gratuits. C'est le maillage interne de l'accueil
 * (SEO) : sans ce bloc, l'accueil ne lierait que 9 métiers et aucun guide
 * précis en dehors du pied de page.
 */
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
  { href: "/guide/tva-travaux", label: "TVA des travaux : 20, 10 ou 5,5 %" },
  { href: "/guide/mentions-obligatoires-facture", label: "Mentions obligatoires sur une facture" },
  { href: "/guide/facture-electronique-2026", label: "La facture électronique" },
  { href: "/guide/plateforme-agreee", label: "Choisir sa plateforme agréée" },
  { href: "/guide", label: "Tous les guides" },
]

const TEMPLATES = [
  { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
  { href: "/modele/devis-electricien", label: "Exemple de devis d'électricien" },
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

const COLUMNS = [
  { title: "Guides", links: GUIDES },
  { title: "Modèles gratuits", links: TEMPLATES },
  { title: "Outils gratuits", links: TOOLS },
]

export function Resources() {
  return (
    <section className={cn(D_SECTION, "border-t border-q-line bg-q-bg")}>
      <Doodles layout="right-short" icons={[Grid3x3, Ruler, Calculator]} />
      <div className={D_WRAP}>
        <SectionTitle title="Pour aller plus loin," accent="gratuitement." />
        <div data-reveal="" className="mt-10">
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
          {COLUMNS.map((col, i) => (
            <div key={col.title} data-reveal="" className={cn(i === 1 && "lp-d1", i === 2 && "lp-d2")}>
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
