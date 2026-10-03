import type { Metadata } from "next"
import { Calculator, FileText, Search, Receipt, FileCheck, Scale, TrendingUp, Hash, ClipboardList, Shield, Wrench, type LucideIcon } from "lucide-react"
import { MetaPixelEvent } from "@/components/shared/MetaPixelEvent"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { ToolCard, ToolShell } from "@/components/outils/kit"

export const metadata: Metadata = {
  title: "Outils gratuits pour auto-entrepreneurs et TPE | Qonforme",
  description: "12 outils gratuits : calculateur TVA, simulateur charges auto-entrepreneur, vérificateur SIRET, générateur de facture et devis PDF. Sans inscription.",
  keywords: ["calculateur tva gratuit", "simulateur charges auto-entrepreneur", "vérificateur siret", "générateur facture gratuit", "outils auto-entrepreneur"],
  alternates: { canonical: "/outils" },
  openGraph: {
    title: "Outils gratuits pour auto-entrepreneurs et TPE | Qonforme",
    description: "12 outils gratuits pour gérer votre activité. Calculateurs, générateurs, vérificateurs — sans inscription.",
    url: "https://qonforme.fr/outils",
    images: [{ url: "/api/og?title=Outils%20gratuits&subtitle=Calculateurs%2C%20g%C3%A9n%C3%A9rateurs%20et%20v%C3%A9rificateurs", width: 1200, height: 630 }],
  },
}

interface Tool {
  title: string
  desc: string
  href: string
  icon: LucideIcon
}

/* ── Les essentiels : grandes cartes en tête ── */
const ESSENTIELS: Tool[] = [
  { title: "Calculateur TVA HT ↔ TTC", desc: "Convertissez instantanément vos montants HT en TTC et inversement avec les 4 taux de TVA français.", href: "/outils/calculateur-tva", icon: Calculator },
  { title: "Générateur de devis gratuit", desc: "Devis professionnel en PDF, en 4 étapes, avec aperçu en direct. Téléchargement immédiat.", href: "/outils/generateur-devis-gratuit", icon: ClipboardList },
  { title: "Générateur de facture gratuit", desc: "Créez une facture professionnelle en PDF. Formulaire simple, téléchargement immédiat.", href: "/outils/generateur-facture-gratuite", icon: FileText },
  { title: "Vérificateur SIREN / SIRET", desc: "Vérifiez une entreprise française avec les données officielles INSEE.", href: "/outils/verification-siret", icon: Search },
]

/* ── Les autres outils, par usage ── */
const CATEGORIES: { title: string; accent: string; tools: Tool[] }[] = [
  {
    title: "Calculer",
    accent: "et simuler.",
    tools: [
      { title: "Simulateur charges auto-entrepreneur", desc: "Cotisations URSSAF, CFP, versement libératoire. Barèmes 2026.", href: "/outils/simulateur-charges-auto-entrepreneur", icon: TrendingUp },
      { title: "Simulateur revenus net", desc: "De votre CA brut à votre revenu net après charges et IR.", href: "/outils/simulateur-revenu-net", icon: TrendingUp },
      { title: "Simulateur seuil TVA", desc: "Franchise de TVA dépassée ? Seuils 2026, jauge et alertes.", href: "/outils/simulateur-seuil-tva", icon: Calculator },
      { title: "Calculateur pénalités de retard", desc: "Intérêts de retard + indemnité forfaitaire de 40 €. Taux du 2ᵉ semestre 2026.", href: "/outils/calculateur-penalites-retard", icon: Scale },
    ],
  },
  {
    title: "Rédiger",
    accent: "et vérifier.",
    tools: [
      { title: "Générateur n° de facture", desc: "Numérotation chronologique, sans rupture, personnalisable.", href: "/outils/generateur-numero-facture", icon: Hash },
      { title: "Générateur conditions de paiement", desc: "Mentions légales à copier-coller : délai, pénalités, escompte.", href: "/outils/generateur-conditions-paiement", icon: Receipt },
      { title: "Vérificateur mentions facture", desc: "Checklist interactive des mentions obligatoires. Score instantané.", href: "/outils/verificateur-mentions-facture", icon: FileCheck },
      { title: "Vérificateur conformité facture", desc: "Critères de la réforme : format, mentions, Factur-X, archivage.", href: "/outils/verificateur-conformite-facture", icon: Shield },
    ],
  },
]

const ALL = [...ESSENTIELS, ...CATEGORIES.flatMap((c) => c.tools)]

export default function OutilsPage() {
  return (
    <ToolShell>
      <MetaPixelEvent event="ViewContent" data={{ content_name: "Outils gratuits", content_category: "tools" }} />

      <OutilsHero
        icon={<Wrench />}
        badge={`${ALL.length} outils gratuits`}
        title="Outils gratuits pour"
        accent="auto-entrepreneurs et TPE."
        subtitle="Calculateurs, générateurs et vérificateurs : tout ce dont vous avez besoin pour préparer vos devis et factures, estimer vos charges et vérifier vos mentions."
        checks={["Résultat instantané", "Sans inscription", "Rien n'est enregistré"]}
      />

      {/* ── Les essentiels ── */}
      <section aria-labelledby="outils-essentiels" className="px-4 sm:px-6">
        <div className="mx-auto w-full max-w-[1120px]">
          <h2 id="outils-essentiels" className="q-eyebrow mb-4">Les essentiels</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {ESSENTIELS.map((t) => (
              <li key={t.href}>
                <ToolCard href={t.href} title={t.title} desc={t.desc} icon={t.icon} size="lg" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Les autres outils, par usage ── */}
      {CATEGORIES.map((cat, i) => (
        <section key={cat.title} aria-labelledby={`outils-cat-${i}`} className="px-4 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto w-full max-w-[1120px]">
            <h2 id={`outils-cat-${i}`} className="mb-6 font-display text-[clamp(26px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em] text-q-ink-strong">
              {cat.title} <span className="q-serif">{cat.accent}</span>
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cat.tools.map((t) => (
                <li key={t.href}>
                  <ToolCard href={t.href} title={t.title} desc={t.desc} icon={t.icon} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <div className="h-16 sm:h-24" aria-hidden />
    </ToolShell>
  )
}
