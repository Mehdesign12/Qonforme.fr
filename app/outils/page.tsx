import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Calculator, FileText, Search, Receipt, FileCheck, Scale, TrendingUp, Hash, ClipboardList, Shield, Zap } from "lucide-react"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

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

const OUTILS = [
  {
    category: "Calculateurs",
    items: [
      {
        title: "Calculateur TVA HT ↔ TTC",
        desc: "Convertissez instantanément vos montants HT en TTC (et inversement) avec les taux de TVA français : 20%, 10%, 5,5%, 2,1%.",
        href: "/outils/calculateur-tva",
        icon: Calculator,
        color: "bg-blue-50 text-blue-600 border-blue-100",
        badge: "Populaire",
      },
      {
        title: "Simulateur charges auto-entrepreneur",
        desc: "Calculez vos cotisations URSSAF, CFP et impôt sur le revenu selon votre CA et votre activité. Barèmes 2026.",
        href: "/outils/simulateur-charges-auto-entrepreneur",
        icon: TrendingUp,
        color: "bg-emerald-50 text-emerald-600 border-emerald-100",
        badge: "Populaire",
      },
      {
        title: "Calculateur pénalités de retard",
        desc: "Calculez les intérêts de retard et l'indemnité forfaitaire de recouvrement pour vos factures impayées.",
        href: "/outils/calculateur-penalites-retard",
        icon: Scale,
        color: "bg-amber-50 text-amber-600 border-amber-100",
      },
      {
        title: "Simulateur seuil TVA",
        desc: "Vérifiez si vous dépassez le seuil de franchise de TVA auto-entrepreneur et quand vous devez facturer la TVA.",
        href: "/outils/simulateur-seuil-tva",
        icon: Calculator,
        color: "bg-violet-50 text-violet-600 border-violet-100",
      },
      {
        title: "Simulateur revenus net",
        desc: "Découvrez votre revenu net réel après charges sociales et impôts à partir de votre chiffre d'affaires.",
        href: "/outils/simulateur-revenu-net",
        icon: TrendingUp,
        color: "bg-cyan-50 text-cyan-600 border-cyan-100",
      },
    ],
  },
  {
    category: "Générateurs",
    items: [
      {
        title: "Générateur de facture gratuit",
        desc: "Créez une facture professionnelle en PDF en quelques minutes. Remplissez le formulaire, téléchargez votre facture.",
        href: "/outils/generateur-facture-gratuite",
        icon: FileText,
        color: "bg-blue-50 text-blue-600 border-blue-100",
        badge: "Populaire",
      },
      {
        title: "Générateur de devis gratuit",
        desc: "Créez un devis professionnel en PDF. Ajoutez vos lignes, votre logo et téléchargez-le immédiatement.",
        href: "/outils/generateur-devis-gratuit",
        icon: ClipboardList,
        color: "bg-indigo-50 text-indigo-600 border-indigo-100",
      },
      {
        title: "Générateur de numéro de facture",
        desc: "Générez un numéro de facture conforme à la réglementation française. Chronologique et sans rupture.",
        href: "/outils/generateur-numero-facture",
        icon: Hash,
        color: "bg-slate-50 text-slate-600 border-slate-200",
      },
      {
        title: "Générateur de conditions de paiement",
        desc: "Générez les mentions légales de conditions de paiement à ajouter sur vos factures et devis.",
        href: "/outils/generateur-conditions-paiement",
        icon: Receipt,
        color: "bg-rose-50 text-rose-600 border-rose-100",
      },
    ],
  },
  {
    category: "Vérificateurs",
    items: [
      {
        title: "Vérificateur SIREN/SIRET",
        desc: "Vérifiez l'existence et les informations d'une entreprise à partir de son numéro SIREN ou SIRET.",
        href: "/outils/verification-siret",
        icon: Search,
        color: "bg-emerald-50 text-emerald-600 border-emerald-100",
        badge: "Populaire",
      },
      {
        title: "Vérificateur mentions obligatoires facture",
        desc: "Vérifiez que votre facture contient toutes les mentions obligatoires exigées par la loi en 2026.",
        href: "/outils/verificateur-mentions-facture",
        icon: FileCheck,
        color: "bg-amber-50 text-amber-600 border-amber-100",
      },
      {
        title: "Vérificateur de conformité facture",
        desc: "Analysez votre facture et identifiez les éléments manquants ou non conformes à la réglementation 2026.",
        href: "/outils/verificateur-conformite-facture",
        icon: Shield,
        color: "bg-violet-50 text-violet-600 border-violet-100",
      },
    ],
  },
]

export default function OutilsPage() {
  return (
    <>
      {/* Nav minimal */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 md:backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/">
            <Image src={LOGO_URL} alt="Qonforme" width={120} height={30} className="h-7 w-auto" sizes="120px" priority />
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
          >
            Commencer →
          </Link>
        </div>
      </header>

      <main className="min-h-screen bg-[#F8FAFC]">
        {/* Hero */}
        <section className="bg-gradient-to-b from-[#EFF6FF] to-[#F8FAFC] px-5 pb-16 pt-16 md:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[13px] font-medium text-[#2563EB]">
              <Zap className="h-3 w-3" />
              100% gratuit — Sans inscription
            </span>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl" style={{ fontFamily: "var(--font-bricolage)" }}>
              Outils gratuits pour{" "}
              <span className="text-[#2563EB]">auto-entrepreneurs</span> et TPE
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-500 sm:text-lg">
              Calculateurs, générateurs et vérificateurs — tout ce dont vous avez besoin pour gérer votre facturation, estimer vos charges et rester conforme. Aucune inscription requise.
            </p>
          </div>
        </section>

        {/* Grille d'outils par catégorie */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          {OUTILS.map((cat) => (
            <div key={cat.category} className="mb-14">
              <h2 className="mb-6 text-xl font-bold text-[#0F172A]">{cat.category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cat.items.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#2563EB]/30 hover:shadow-md"
                  >
                    {"badge" in tool && tool.badge && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#2563EB] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {tool.badge}
                      </span>
                    )}
                    <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${tool.color}`}>
                      <tool.icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-[15px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                      {tool.title}
                    </h3>
                    <p className="mt-2 flex-1 text-[13px] leading-relaxed text-slate-500">
                      {tool.desc}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] opacity-0 transition-opacity group-hover:opacity-100">
                      Utiliser l&apos;outil <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="border-t border-slate-200 bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold text-[#0F172A] sm:text-3xl" style={{ fontFamily: "var(--font-bricolage)" }}>
              Besoin d&apos;automatiser tout ça ?
            </h2>
            <p className="mt-3 text-slate-500">
              Qonforme génère vos factures Factur-X conformes 2026, envoie vos devis par email et relance vos clients automatiquement. Dès 9&nbsp;€/mois.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
              >
                Commencer maintenant <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-[#0F172A] transition-colors hover:border-[#2563EB]/40"
              >
                Voir la démo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
