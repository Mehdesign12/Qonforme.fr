/**
 * Liens des pages publiques, partagés par l'en-tête (PublicNav, composant
 * client) et le pied de page (Footer, composant serveur). Module sans
 * « use client » : les deux peuvent l'importer comme de simples données.
 */
import {
  Calculator,
  ClipboardList,
  FileCheck,
  FileText,
  Hash,
  Receipt,
  Scale,
  Search,
  Shield,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

export interface OutilLink {
  label: string
  href: string
  icon: LucideIcon
  desc: string
}

/** Les 12 outils gratuits, rangés comme dans le hub /outils. */
export const OUTILS_CATEGORIES: { title: string; items: OutilLink[] }[] = [
  {
    title: "Calculateurs",
    items: [
      { label: "Calculateur TVA HT ↔ TTC", href: "/outils/calculateur-tva", icon: Calculator, desc: "Conversion instantanée HT/TTC" },
      { label: "Simulateur charges auto-entrepreneur", href: "/outils/simulateur-charges-auto-entrepreneur", icon: TrendingUp, desc: "Cotisations URSSAF 2026" },
      { label: "Calculateur pénalités de retard", href: "/outils/calculateur-penalites-retard", icon: Scale, desc: "Intérêts légaux et indemnité" },
      { label: "Simulateur seuil TVA", href: "/outils/simulateur-seuil-tva", icon: Calculator, desc: "Franchise de TVA dépassée\u00a0?" },
    ],
  },
  {
    title: "Générateurs",
    items: [
      { label: "Générateur de facture gratuit", href: "/outils/generateur-facture-gratuite", icon: FileText, desc: "Une facture PDF en quelques minutes" },
      { label: "Générateur de devis gratuit", href: "/outils/generateur-devis-gratuit", icon: ClipboardList, desc: "Un devis professionnel en PDF" },
      { label: "Générateur n° de facture", href: "/outils/generateur-numero-facture", icon: Hash, desc: "Numérotation sans rupture" },
      { label: "Générateur conditions de paiement", href: "/outils/generateur-conditions-paiement", icon: Receipt, desc: "Mentions légales à copier" },
    ],
  },
  {
    title: "Vérificateurs",
    items: [
      { label: "Vérificateur SIREN/SIRET", href: "/outils/verification-siret", icon: Search, desc: "Vérifiez une entreprise" },
      { label: "Vérificateur mentions facture", href: "/outils/verificateur-mentions-facture", icon: FileCheck, desc: "Mentions obligatoires 2026" },
      { label: "Vérificateur conformité facture", href: "/outils/verificateur-conformite-facture", icon: Shield, desc: "Checklist de conformité 2026" },
      { label: "Simulateur revenus net", href: "/outils/simulateur-revenu-net", icon: TrendingUp, desc: "Revenus réels après charges" },
    ],
  },
]

export const OUTILS_COUNT = OUTILS_CATEGORIES.reduce((n, c) => n + c.items.length, 0)

/** Sélection courte (menu mobile, pied de page). */
export const OUTILS_ESSENTIELS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Calculateur TVA", href: "/outils/calculateur-tva", icon: Calculator },
  { label: "Générateur de devis", href: "/outils/generateur-devis-gratuit", icon: ClipboardList },
  { label: "Générateur de facture", href: "/outils/generateur-facture-gratuite", icon: FileText },
  { label: "Vérificateur SIRET", href: "/outils/verification-siret", icon: Search },
  { label: "Simulateur charges", href: "/outils/simulateur-charges-auto-entrepreneur", icon: TrendingUp },
  { label: "Conformité facture", href: "/outils/verificateur-conformite-facture", icon: Shield },
]
