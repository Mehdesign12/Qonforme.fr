"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import { ArrowRight, TrendingUp, ChevronRight, RotateCcw, Copy, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { ACTIVITES, calculerCharges, type ActiviteId } from "@/lib/outils/charges"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) }

const TRANCHES_IR = [
  { min: 0, max: 11294, taux: 0 },
  { min: 11294, max: 28797, taux: 11 },
  { min: 28797, max: 82341, taux: 30 },
  { min: 82341, max: 177106, taux: 41 },
  { min: 177106, max: Infinity, taux: 45 },
]

function calculerIR(revenuImposable: number): number {
  let impot = 0
  for (const t of TRANCHES_IR) {
    if (revenuImposable <= t.min) break
    const base = Math.min(revenuImposable, t.max) - t.min
    impot += base * (t.taux / 100)
  }
  return Math.round(impot)
}

export default function SimulateurRevenuNetPage() {
  const [ca, setCa] = useState("")
  const [activiteId, setActiviteId] = useState<ActiviteId>("prestations-bnc")
  const [periode, setPeriode] = useState<"mensuel" | "annuel">("mensuel")
  const [copied, setCopied] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const numCa = parseFloat(ca.replace(",", ".").replace(/\s/g, "")) || 0
  const caAnnuel = periode === "mensuel" ? numCa * 12 : numCa
  const activite = ACTIVITES.find((a) => a.id === activiteId)!

  const result = useMemo(() => {
    if (caAnnuel <= 0) return null
    const charges = calculerCharges(caAnnuel, activiteId, false)
    const revenuImposable = Math.round(caAnnuel * (1 - activite.abattement / 100))
    const impotAnnuel = calculerIR(revenuImposable)
    const netAnnuel = caAnnuel - charges.totalCharges - impotAnnuel
    return { caAnnuel, charges: charges.totalCharges, tauxCharges: charges.tauxEffectif, revenuImposable, abattement: activite.abattement, impotAnnuel, netAnnuel, netMensuel: Math.round(netAnnuel / 12) }
  }, [caAnnuel, activiteId, activite.abattement])

  const handleCopy = () => { if (!result) return; navigator.clipboard.writeText(`CA: ${fmtEur(result.caAnnuel)} | Charges: ${fmtEur(result.charges)} | IR: ${fmtEur(result.impotAnnuel)} | Net: ${fmtEur(result.netAnnuel)}/an (${fmtEur(result.netMensuel)}/mois)`); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const handleCaChange = (v: string) => { setCa(v.replace(/[^0-9.,\s]/g, "")); setTimeout(() => { if (resultRef.current && parseFloat(v.replace(",", ".").replace(/\s/g, "")) > 0) resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, 100) }

  // Visual bar
  const netPercent = result ? Math.max(0, (result.netAnnuel / result.caAnnuel) * 100) : 0
  const chargesPercent = result ? (result.charges / result.caAnnuel) * 100 : 0
  const irPercent = result ? (result.impotAnnuel / result.caAnnuel) * 100 : 0

  return (
    <>
      <OutilsHeader breadcrumb="Revenus net" />
      <OutilsHero icon={<TrendingUp className="h-8 w-8" />} iconBg="bg-cyan-50 text-cyan-600" title={<>Simulateur <span className="text-[#2563EB]">revenus net</span></>} subtitle="De votre chiffre d'affaires brut à votre revenu net réel. Charges sociales + impôt sur le revenu." badge="Barèmes 2026" />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-xl px-5 -mt-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8">
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Type d&apos;activité</label>
              <select value={activiteId} onChange={(e) => setActiviteId(e.target.value as ActiviteId)} className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-semibold text-[#0F172A] outline-none transition-all focus:border-[#2563EB] focus:bg-white">
                {ACTIVITES.map((a) => <option key={a.id} value={a.id}>{a.label} (abattement {a.abattement}%)</option>)}
              </select>
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-bold text-slate-700">Chiffre d&apos;affaires</label>
                <div className="flex rounded-lg bg-slate-100 p-0.5">
                  <button onClick={() => { setPeriode("mensuel"); setCa("") }} className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${periode === "mensuel" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500"}`}>Mensuel</button>
                  <button onClick={() => { setPeriode("annuel"); setCa("") }} className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${periode === "annuel" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500"}`}>Annuel</button>
                </div>
              </div>
              <div className="relative">
                <input type="text" inputMode="decimal" value={ca} onChange={(e) => handleCaChange(e.target.value)} placeholder={periode === "mensuel" ? "3 000" : "36 000"} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-extrabold text-[#0F172A] placeholder-slate-200 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:shadow-lg focus:shadow-blue-100/40" autoFocus />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">€</span>
              </div>
            </div>

            <div ref={resultRef}>
              <AnimatePresence>
                {result && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                    {/* Stacked bar */}
                    <div className="mb-4 rounded-xl bg-slate-50 p-4">
                      <p className="text-[12px] font-bold text-slate-500 mb-2">Répartition de votre CA</p>
                      <div className="flex h-6 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${netPercent}%` }} transition={{ duration: 0.6 }} className="bg-emerald-500" title={`Net: ${Math.round(netPercent)}%`} />
                        <motion.div initial={{ width: 0 }} animate={{ width: `${chargesPercent}%` }} transition={{ duration: 0.6, delay: 0.1 }} className="bg-amber-400" title={`Charges: ${Math.round(chargesPercent)}%`} />
                        <motion.div initial={{ width: 0 }} animate={{ width: `${irPercent}%` }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-red-400" title={`IR: ${Math.round(irPercent)}%`} />
                      </div>
                      <div className="flex gap-4 mt-2 text-[11px] font-semibold">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Net {Math.round(netPercent)}%</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Charges {Math.round(chargesPercent)}%</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> IR {Math.round(irPercent)}%</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#ECFDF5] p-5">
                      <div className="space-y-2.5">
                        <div className="flex justify-between text-[14px]"><span className="text-slate-600">Chiffre d&apos;affaires annuel</span><span className="font-semibold">{fmtEur(result.caAnnuel)}</span></div>
                        <div className="flex justify-between text-[14px]"><span className="text-slate-600">Charges sociales ({result.tauxCharges}%)</span><span className="font-semibold text-amber-600">-{fmtEur(result.charges)}</span></div>
                        <div className="flex justify-between text-[14px]"><span className="text-slate-600">Revenu imposable (abattement {result.abattement}%)</span><span className="font-semibold text-slate-500">{fmtEur(result.revenuImposable)}</span></div>
                        <div className="flex justify-between text-[14px]"><span className="text-slate-600">Impôt sur le revenu (estimé)</span><span className="font-semibold text-red-500">-{fmtEur(result.impotAnnuel)}</span></div>
                        <div className="h-px bg-slate-200/60 my-1" />
                        <div className="flex justify-between text-[16px]"><span className="font-bold text-[#0F172A]">Revenu net annuel</span><span className="font-extrabold text-emerald-600">{fmtEur(result.netAnnuel)}</span></div>
                        <div className="flex justify-between text-[18px] pt-1"><span className="font-bold text-[#0F172A]">Soit par mois</span><span className="font-extrabold text-emerald-600">{fmtEur(result.netMensuel)}</span></div>
                      </div>
                      <button onClick={handleCopy} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-slate-400 hover:text-[#2563EB] hover:bg-white/60 transition-all">
                        {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copié !</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
                      </button>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-400">
                      <strong>Note :</strong> L&apos;IR est estimé pour une personne seule (1 part). Le calcul réel dépend de votre situation familiale et de vos autres revenus.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {numCa > 0 && <button onClick={() => setCa("")} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"><RotateCcw className="h-3.5 w-3.5" /> Réinitialiser</button>}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#ECFDF5] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Dashboard CA et revenus en temps réel</p>
            <p className="mt-1 text-[13px] text-slate-500">Suivez votre CA, vos paiements et vos charges mois par mois avec Qonforme.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">Suivre mon activité <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>

        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Comment calculer son revenu net d&apos;auto-entrepreneur ?</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>Le revenu net d&apos;un auto-entrepreneur se calcule en <strong>3 étapes</strong> :</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li><strong>Cotisations sociales</strong> — un pourcentage du CA (12,3% à 23,2% selon l&apos;activité)</li>
                <li><strong>Abattement fiscal</strong> — le fisc applique un abattement forfaitaire sur le CA (34% à 71%) pour déterminer le revenu imposable</li>
                <li><strong>Impôt sur le revenu</strong> — barème progressif appliqué au revenu imposable (0% à 45%)</li>
              </ol>
              <div className="rounded-xl bg-slate-50 p-4 font-mono text-[14px]"><p><strong>Net</strong> = CA − Cotisations − Impôt sur le revenu</p></div>
            </div>
            <div className="mt-12"><h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[{ q: "L'abattement fiscal est-il automatique ?", a: "Oui, le fisc l'applique automatiquement sur votre déclaration. Vous déclarez votre CA brut." }, { q: "Le versement libératoire change-t-il le calcul ?", a: "Oui, il remplace l'IR progressif par un taux fixe (1% à 2,2%). Utilisez le simulateur de charges pour cette option." }, { q: "Ce calcul est-il exact ?", a: "C'est une estimation pour 1 part fiscale. Votre IR réel dépend de votre foyer fiscal et autres revenus." }].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p></details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6"><h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3><div className="grid gap-2 sm:grid-cols-2">
              {[{ href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simulateur charges" }, { href: "/outils/simulateur-seuil-tva", label: "Simulateur seuil TVA" }, { href: "/outils/calculateur-tva", label: "Calculateur TVA" }, { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" }].map((l) => (<Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>))}
            </div></div>
          </div>
        </section>
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Simulateur revenus net auto-entrepreneur", url: "https://qonforme.fr/outils/simulateur-revenu-net", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"L'abattement fiscal est-il automatique ?","acceptedAnswer":{"@type":"Answer","text":"Oui, le fisc l'applique automatiquement. Vous déclarez votre CA brut."}},{"@type":"Question","name":"Le versement libératoire change-t-il le calcul ?","acceptedAnswer":{"@type":"Answer","text":"Oui, il remplace l'IR progressif par un taux fixe (1% à 2,2%)."}},{"@type":"Question","name":"Ce calcul est-il exact ?","acceptedAnswer":{"@type":"Answer","text":"C'est une estimation pour 1 part fiscale."}}]}) }} />
      </main>
      <OutilsCtaBar text="Dashboard revenus en temps réel" cta="Essayer →" />
      <Footer />
    </>
  )
}
