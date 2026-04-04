"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, TrendingUp, RotateCcw, ChevronRight, Info, PieChart } from "lucide-react"
import { motion } from "motion/react"
import Footer from "@/components/layout/Footer"
import { ACTIVITES, calculerCharges, type ActiviteId } from "@/lib/outils/charges"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

export default function SimulateurChargesPage() {
  const [ca, setCa] = useState("")
  const [activiteId, setActiviteId] = useState<ActiviteId>("prestations-bnc")
  const [versementLiberatoire, setVersementLiberatoire] = useState(false)
  const [periode, setPeriode] = useState<"mensuel" | "annuel">("mensuel")

  const numCa = parseFloat(ca.replace(",", ".").replace(/\s/g, "")) || 0
  const caAnnuel = periode === "mensuel" ? numCa * 12 : numCa
  const caMensuel = periode === "annuel" ? numCa / 12 : numCa

  const activite = ACTIVITES.find((a) => a.id === activiteId)!

  const resultAnnuel = useMemo(
    () => calculerCharges(caAnnuel, activiteId, versementLiberatoire),
    [caAnnuel, activiteId, versementLiberatoire]
  )

  const resultMensuel = useMemo(
    () => calculerCharges(caMensuel, activiteId, versementLiberatoire),
    [caMensuel, activiteId, versementLiberatoire]
  )

  const depassePlafond = caAnnuel > activite.plafondCA

  return (
    <>
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 md:backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/">
            <Image src={LOGO_URL} alt="Qonforme" width={120} height={30} className="h-7 w-auto" sizes="120px" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/outils" className="text-sm font-medium text-slate-500 hover:text-[#0F172A] transition-colors hidden sm:block">
              ← Tous les outils
            </Link>
            <Link href="/signup" className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">
              Commencer →
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-[#F8FAFC]">
        {/* Breadcrumb */}
        <div className="mx-auto max-w-3xl px-5 pt-6">
          <nav className="flex items-center gap-1.5 text-[13px] text-slate-400">
            <Link href="/outils" className="hover:text-[#2563EB] transition-colors">Outils gratuits</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-600 font-medium">Simulateur charges</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="mx-auto max-w-3xl px-5 pt-8 pb-6 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Simulateur charges <span className="text-[#2563EB]">auto-entrepreneur</span>
          </h1>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Calculez vos cotisations URSSAF, CFP et versement libératoire selon votre chiffre d&apos;affaires et votre activité. Barèmes 2026.
          </p>
        </section>

        {/* Outil */}
        <section className="mx-auto max-w-2xl px-5 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            {/* Type d'activité */}
            <div className="mb-5">
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Type d&apos;activité
              </label>
              <div className="grid gap-2">
                {ACTIVITES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setActiviteId(a.id as ActiviteId)}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      activiteId === a.id
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className={`block text-[14px] font-semibold ${activiteId === a.id ? "text-[#2563EB]" : "text-[#0F172A]"}`}>
                      {a.label}
                    </span>
                    <span className="block text-[12px] text-slate-400 mt-0.5">
                      Cotisations {a.tauxCotisations}% · CFP {a.tauxCFP}% · Plafond CA {new Intl.NumberFormat("fr-FR").format(a.plafondCA)} €
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chiffre d'affaires */}
            <div className="mb-5">
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Chiffre d&apos;affaires (€)
              </label>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex rounded-lg bg-slate-50 p-0.5">
                  <button
                    onClick={() => { setPeriode("mensuel"); setCa("") }}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${periode === "mensuel" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500"}`}
                  >
                    Mensuel
                  </button>
                  <button
                    onClick={() => { setPeriode("annuel"); setCa("") }}
                    className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${periode === "annuel" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500"}`}
                  >
                    Annuel
                  </button>
                </div>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={ca}
                onChange={(e) => setCa(e.target.value.replace(/[^0-9.,\s]/g, ""))}
                placeholder={periode === "mensuel" ? "Ex : 3000" : "Ex : 36000"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-[#0F172A] placeholder-slate-300 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
              />
            </div>

            {/* Versement libératoire */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={versementLiberatoire}
                    onChange={(e) => setVersementLiberatoire(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#2563EB]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </div>
                <div>
                  <span className="text-[14px] font-semibold text-[#0F172A]">Versement libératoire de l&apos;impôt</span>
                  <span className="block text-[12px] text-slate-400">+{activite.tauxVersementLiberatoire}% supplémentaire sur le CA</span>
                </div>
              </label>
            </div>

            {/* Alerte plafond */}
            {depassePlafond && numCa > 0 && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-amber-800">Plafond dépassé</p>
                  <p className="text-[12px] text-amber-700 mt-0.5">
                    Votre CA annuel ({fmtEur(caAnnuel)}) dépasse le plafond de {new Intl.NumberFormat("fr-FR").format(activite.plafondCA)} € pour cette activité. Vous risquez de perdre le statut de micro-entrepreneur.
                  </p>
                </div>
              </div>
            )}

            {/* Résultats */}
            {numCa > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Résultat mensuel */}
                <div className="rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#ECFDF5] p-5 mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="h-4 w-4 text-[#2563EB]" />
                    <p className="text-[13px] font-bold text-[#0F172A]">Résultat mensuel</p>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[14px]">
                      <span className="text-slate-600">Chiffre d&apos;affaires</span>
                      <span className="font-semibold text-[#0F172A]">{fmtEur(caMensuel)}</span>
                    </div>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-slate-600">Cotisations sociales ({activite.tauxCotisations}%)</span>
                      <span className="font-semibold text-red-500">-{fmtEur(resultMensuel.cotisations)}</span>
                    </div>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-slate-600">CFP ({activite.tauxCFP}%)</span>
                      <span className="font-semibold text-red-500">-{fmtEur(resultMensuel.cfp)}</span>
                    </div>
                    {resultMensuel.versementLiberatoire !== null && (
                      <div className="flex justify-between text-[14px]">
                        <span className="text-slate-600">Versement libératoire ({activite.tauxVersementLiberatoire}%)</span>
                        <span className="font-semibold text-red-500">-{fmtEur(resultMensuel.versementLiberatoire)}</span>
                      </div>
                    )}
                    <div className="h-px bg-slate-200 my-1" />
                    <div className="flex justify-between text-[14px]">
                      <span className="text-slate-600">Total charges ({resultMensuel.tauxEffectif}%)</span>
                      <span className="font-bold text-red-600">-{fmtEur(resultMensuel.totalCharges)}</span>
                    </div>
                    <div className="flex justify-between text-[16px] pt-1">
                      <span className="font-bold text-[#0F172A]">Revenu net estimé</span>
                      <span className="font-extrabold text-emerald-600">{fmtEur(resultMensuel.revenuNet)}</span>
                    </div>
                  </div>
                </div>

                {/* Résultat annuel */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                  <p className="text-[13px] font-bold text-slate-500 mb-3">Projection annuelle</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">CA annuel</p>
                      <p className="mt-1 text-[15px] font-bold text-[#0F172A]">{fmtEur(caAnnuel)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Charges</p>
                      <p className="mt-1 text-[15px] font-bold text-red-500">-{fmtEur(resultAnnuel.totalCharges)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Net annuel</p>
                      <p className="mt-1 text-[15px] font-bold text-emerald-600">{fmtEur(resultAnnuel.revenuNet)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Reset */}
            {numCa > 0 && (
              <button
                onClick={() => setCa("")}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            )}
          </motion.div>

          {/* CTA */}
          <div className="mt-8 rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#ECFDF5] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Suivez votre CA en temps réel</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Qonforme vous donne un tableau de bord avec votre CA mensuel, vos factures en attente et vos relances automatiques.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Suivre mon activité <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Contenu SEO */}
        <section className="border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Comprendre les charges auto-entrepreneur en 2026</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>
                En tant qu&apos;<strong>auto-entrepreneur</strong> (ou micro-entrepreneur), vous payez des <strong>cotisations sociales proportionnelles</strong> à votre chiffre d&apos;affaires. Le taux dépend de votre type d&apos;activité.
              </p>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Les cotisations URSSAF</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-4 text-left font-semibold text-[#0F172A]">Activité</th>
                      <th className="py-2 px-4 text-right font-semibold text-[#0F172A]">Cotisations</th>
                      <th className="py-2 px-4 text-right font-semibold text-[#0F172A]">CFP</th>
                      <th className="py-2 pl-4 text-right font-semibold text-[#0F172A]">Plafond CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACTIVITES.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100">
                        <td className="py-2.5 pr-4 text-slate-600">{a.label}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold">{a.tauxCotisations}%</td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold">{a.tauxCFP}%</td>
                        <td className="py-2.5 pl-4 text-right font-mono font-semibold">{new Intl.NumberFormat("fr-FR").format(a.plafondCA)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Le versement libératoire de l&apos;impôt sur le revenu</h3>
              <p>
                Si votre revenu fiscal de référence ne dépasse pas certains seuils, vous pouvez opter pour le <strong>versement libératoire</strong>. Vous payez alors un pourcentage supplémentaire sur votre CA en échange de ne pas être imposé sur ces revenus dans votre déclaration annuelle.
              </p>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">La Contribution à la Formation Professionnelle (CFP)</h3>
              <p>
                La CFP est une contribution obligatoire qui vous donne droit à des formations. Son taux varie de 0,1% à 0,3% selon votre activité.
              </p>
            </div>

            {/* FAQ */}
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-4">
                {[
                  {
                    q: "Quand dois-je payer mes cotisations URSSAF ?",
                    a: "Vous déclarez et payez vos cotisations chaque mois ou chaque trimestre (au choix) sur le site autoentrepreneur.urssaf.fr. La déclaration est obligatoire même si votre CA est de 0 €.",
                  },
                  {
                    q: "Que se passe-t-il si je dépasse le plafond de CA ?",
                    a: "Si vous dépassez le plafond 2 années consécutives, vous basculez automatiquement vers le régime réel (entreprise individuelle classique). Les cotisations et obligations comptables changent significativement.",
                  },
                  {
                    q: "Le versement libératoire est-il intéressant pour moi ?",
                    a: "C'est intéressant si votre taux marginal d'imposition est supérieur au taux du versement libératoire (1% à 2,2%). Pour les revenus modestes, l'imposition classique peut être plus avantageuse.",
                  },
                  {
                    q: "Ces charges incluent-elles la retraite ?",
                    a: "Oui, les cotisations sociales incluent l'assurance maladie, la retraite de base, la retraite complémentaire, les allocations familiales et la CSG/CRDS.",
                  },
                ].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50">
                    <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">
                      {item.q}
                      <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>

            {/* Maillage interne */}
            <div className="mt-12 rounded-xl bg-slate-50 p-6">
              <h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/outils/calculateur-tva" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Calculateur TVA HT/TTC
                </Link>
                <Link href="/outils/simulateur-seuil-tva" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Simulateur seuil TVA
                </Link>
                <Link href="/outils/generateur-facture-gratuite" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Générateur de facture gratuit
                </Link>
                <Link href="/outils/simulateur-revenu-net" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Simulateur revenus net
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Simulateur charges auto-entrepreneur 2026",
              description: "Calculez vos cotisations URSSAF, CFP et versement libératoire selon votre chiffre d'affaires et votre activité.",
              url: "https://qonforme.fr/outils/simulateur-charges-auto-entrepreneur",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Any",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              author: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
            }),
          }}
        />
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "Quand dois-je payer mes cotisations URSSAF ?", acceptedAnswer: { "@type": "Answer", text: "Vous déclarez et payez vos cotisations chaque mois ou chaque trimestre sur autoentrepreneur.urssaf.fr." } },
                { "@type": "Question", name: "Que se passe-t-il si je dépasse le plafond de CA ?", acceptedAnswer: { "@type": "Answer", text: "Si vous dépassez le plafond 2 années consécutives, vous basculez vers le régime réel." } },
                { "@type": "Question", name: "Le versement libératoire est-il intéressant ?", acceptedAnswer: { "@type": "Answer", text: "C'est intéressant si votre taux marginal d'imposition est supérieur au taux du versement libératoire (1% à 2,2%)." } },
              ],
            }),
          }}
        />
      </main>

      <Footer />
    </>
  )
}
