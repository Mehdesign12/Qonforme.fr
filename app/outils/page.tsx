import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Calculator, FileText, Search, Receipt, FileCheck, Scale, TrendingUp, Hash, ClipboardList, Shield, Zap, Lock, Star, Sparkles } from "lucide-react"
import Footer from "@/components/layout/Footer"
import { HubClient } from "./hub-client"

const PICTO_Q_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp"

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

/* ── Outils populaires (Sprint 1 — actifs) ── */
const POPULAIRES = [
  {
    title: "Calculateur TVA HT ↔ TTC",
    desc: "Convertissez instantanément vos montants HT en TTC et inversement avec les 4 taux de TVA français.",
    href: "/outils/calculateur-tva",
    icon: Calculator,
    gradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-white/20",
  },
  {
    title: "Simulateur charges auto-entrepreneur",
    desc: "Cotisations URSSAF, CFP, versement libératoire. Barèmes 2026 à jour.",
    href: "/outils/simulateur-charges-auto-entrepreneur",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-white/20",
  },
  {
    title: "Vérificateur SIREN / SIRET",
    desc: "Vérifiez une entreprise française avec les données officielles INSEE.",
    href: "/outils/verification-siret",
    icon: Search,
    gradient: "from-violet-500 to-purple-600",
    iconBg: "bg-white/20",
  },
  {
    title: "Générateur de facture gratuit",
    desc: "Créez une facture professionnelle en PDF. Formulaire simple, téléchargement immédiat.",
    href: "/outils/generateur-facture-gratuite",
    icon: FileText,
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-white/20",
  },
]

/* ── Outils Sprint 2 (actifs) ── */
const SPRINT2 = [
  { title: "Générateur de devis gratuit", desc: "Devis professionnel en PDF. Wizard 4 étapes, téléchargement immédiat.", href: "/outils/generateur-devis-gratuit", icon: ClipboardList, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
  { title: "Calculateur pénalités de retard", desc: "Intérêts de retard + indemnité forfaitaire 40 €. Taux BCE 2026.", href: "/outils/calculateur-penalites-retard", icon: Scale, color: "text-amber-600 bg-amber-50 border-amber-100" },
  { title: "Vérificateur mentions facture", desc: "Checklist interactive des 21 mentions obligatoires. Score instantané.", href: "/outils/verificateur-mentions-facture", icon: FileCheck, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { title: "Vérificateur conformité facture", desc: "Score de conformité 2026 : format, mentions, Factur-X, archivage.", href: "/outils/verificateur-conformite-facture", icon: Shield, color: "text-violet-600 bg-violet-50 border-violet-100" },
]

/* ── Outils Sprint 3 (actifs) ── */
const SPRINT3 = [
  { title: "Simulateur seuil TVA", desc: "Franchise TVA dépassée ? Seuils 2026, barre visuelle, alertes.", href: "/outils/simulateur-seuil-tva", icon: Calculator, color: "text-blue-600 bg-blue-50 border-blue-100" },
  { title: "Simulateur revenus net", desc: "De votre CA brut à votre revenu net après charges et IR.", href: "/outils/simulateur-revenu-net", icon: TrendingUp, color: "text-cyan-600 bg-cyan-50 border-cyan-100" },
  { title: "Générateur n° de facture", desc: "Numérotation conforme : chronologique, sans rupture, personnalisable.", href: "/outils/generateur-numero-facture", icon: Hash, color: "text-slate-600 bg-slate-100 border-slate-200" },
  { title: "Générateur conditions paiement", desc: "Mentions légales à copier-coller : délai, pénalités, escompte.", href: "/outils/generateur-conditions-paiement", icon: Receipt, color: "text-rose-600 bg-rose-50 border-rose-100" },
]

export default function OutilsPage() {
  return (
    <>
      {/* Header pill — client component */}
      <HubClient />

      {/* ── Hero gradient + Q ── */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          background:
            "linear-gradient(125deg, #EFF6FF 0%, #EEF2FF 20%, #F5F3FF 35%, #E0F2FE 50%, #EFF6FF 65%, #F0FDF4 80%, #EEF2FF 100%)",
        }}
      >
        {/* Lueurs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 20% -10%, rgba(37,99,235,0.08) 0%, transparent 55%), " +
              "radial-gradient(ellipse 40% 40% at 80% 0%, rgba(124,58,237,0.06) 0%, transparent 50%)",
          }}
        />

        {/* Q mobile */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center md:hidden" style={{ opacity: 0.05 }}>
          <Image src={PICTO_Q_URL} alt="" width={260} height={260} className="w-[220px] select-none" sizes="220px" loading="lazy" />
        </div>

        {/* Q desktop */}
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-4 z-[1] hidden md:block" style={{ opacity: 0.04 }}>
          <Image src={PICTO_Q_URL} alt="" width={400} height={400} className="w-[340px] select-none" sizes="340px" loading="lazy" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-5 pb-10 pt-24 text-center sm:pb-16 sm:pt-28 lg:pt-32">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-white/70 px-3.5 py-1 text-[12px] font-semibold text-[#2563EB]">
            <Zap className="h-3 w-3" />
            100% gratuit — Sans inscription
          </span>

          <h1 className="mt-6 text-[1.9rem] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.6rem] lg:text-[3.2rem]" style={{ fontFamily: "var(--font-bricolage)" }}>
            Outils gratuits pour{" "}
            <span className="text-[#2563EB]">auto-entrepreneurs</span>
            <br className="hidden sm:block" />
            {" "}et TPE
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-500 sm:text-base lg:text-lg">
            Calculateurs, générateurs et vérificateurs — tout ce dont vous avez besoin pour gérer votre facturation, estimer vos charges et rester conforme.
          </p>

          {/* Reassurance */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {[
              { icon: <Zap className="h-3 w-3" />, label: "Résultat instantané", color: "text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]/60" },
              { icon: <Lock className="h-3 w-3" />, label: "Aucune inscription", color: "text-slate-500 bg-white/70 border-slate-200/70" },
              { icon: <Shield className="h-3 w-3" />, label: "Données non stockées", color: "text-emerald-600 bg-[#ECFDF5] border-[#A7F3D0]/60" },
            ].map((b) => (
              <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${b.color}`}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Fade bas */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(to bottom, transparent 0%, #F8FAFC 100%)" }} />
      </div>

      <main className="bg-[#F8FAFC]">
        {/* ── Section populaires — grandes cards gradient ── */}
        <section className="mx-auto max-w-5xl px-5 pb-16 -mt-2">
          <div className="mb-6 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            <h2 className="text-lg font-bold text-[#0F172A]">Les plus populaires</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {POPULAIRES.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${tool.gradient} p-6 text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] sm:p-7`}
              >
                {/* Decorative circle */}
                <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                <div aria-hidden className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />

                <div className="relative z-10">
                  <span className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${tool.iconBg}`}>
                    <tool.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-[17px] font-bold leading-snug sm:text-[18px]">{tool.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/80">{tool.desc}</p>
                </div>

                <span className="relative z-10 mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/90 group-hover:text-white transition-colors">
                  Utiliser l&apos;outil <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Sprint 2 — cards actives ── */}
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-lg font-bold text-[#0F172A]">Tous les outils</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SPRINT2.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#2563EB]/30 hover:shadow-md"
              >
                <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl border ${tool.color}`}>
                  <tool.icon className="h-5 w-5" />
                </span>
                <h3 className="text-[14px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors leading-snug">{tool.title}</h3>
                <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-500">{tool.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] opacity-0 transition-opacity group-hover:opacity-100">
                  Utiliser <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Sprint 3 — cards actives ── */}
        <section className="mx-auto max-w-5xl px-5 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SPRINT3.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#2563EB]/30 hover:shadow-md"
              >
                <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl border ${tool.color}`}>
                  <tool.icon className="h-5 w-5" />
                </span>
                <h3 className="text-[14px] font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors leading-snug">{tool.title}</h3>
                <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-slate-500">{tool.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] opacity-0 transition-opacity group-hover:opacity-100">
                  Utiliser <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── CTA conversion ── */}
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
