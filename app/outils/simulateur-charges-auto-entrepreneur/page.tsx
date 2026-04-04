"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import { ArrowRight, TrendingUp, RotateCcw, ChevronRight, Info, Copy, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { ACTIVITES, calculerCharges, type ActiviteId } from "@/lib/outils/charges"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

export default function SimulateurChargesPage() {
  const [ca, setCa] = useState("")
  const [activiteId, setActiviteId] = useState<ActiviteId>("prestations-bnc")
  const [versementLiberatoire, setVersementLiberatoire] = useState(false)
  const [periode, setPeriode] = useState<"mensuel" | "annuel">("mensuel")
  const [copied, setCopied] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const numCa = parseFloat(ca.replace(",", ".").replace(/\s/g, "")) || 0
  const caAnnuel = periode === "mensuel" ? numCa * 12 : numCa
  const caMensuel = periode === "annuel" ? numCa / 12 : numCa
  const activite = ACTIVITES.find((a) => a.id === activiteId)!

  const resultAnnuel = useMemo(() => calculerCharges(caAnnuel, activiteId, versementLiberatoire), [caAnnuel, activiteId, versementLiberatoire])
  const resultMensuel = useMemo(() => calculerCharges(caMensuel, activiteId, versementLiberatoire), [caMensuel, activiteId, versementLiberatoire])

  const depassePlafond = caAnnuel > activite.plafondCA

  // Gauge percentage for visual bar
  const gaugePercent = Math.min(resultMensuel.tauxEffectif / 30 * 100, 100)

  const handleCopy = () => {
    const t = `CA mensuel: ${fmtEur(caMensuel)} | Charges: ${fmtEur(resultMensuel.totalCharges)} (${resultMensuel.tauxEffectif}%) | Net: ${fmtEur(resultMensuel.revenuNet)}`
    navigator.clipboard.writeText(t)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCaChange = (v: string) => {
    setCa(v.replace(/[^0-9.,\s]/g, ""))
    setTimeout(() => {
      if (resultRef.current && parseFloat(v.replace(",", ".").replace(/\s/g, "")) > 0) {
        resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  return (
    <>
      <OutilsHeader breadcrumb="Simulateur charges" />

      <OutilsHero
        icon={<TrendingUp className="h-8 w-8" />}
        iconBg="bg-emerald-50 text-emerald-600"
        title={<>Simulateur charges <span className="text-[#2563EB]">auto-entrepreneur</span></>}
        subtitle="Calculez vos cotisations URSSAF, CFP et versement libératoire selon votre CA et votre activité. Barèmes 2026."
        badge="Barèmes 2026"
      />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-2xl px-5 -mt-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8"
          >
            {/* Activité */}
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Type d&apos;activité</label>
              <div className="grid gap-2">
                {ACTIVITES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setActiviteId(a.id as ActiviteId)}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      activiteId === a.id ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      activiteId === a.id ? "border-[#2563EB] bg-[#2563EB]" : "border-slate-300"
                    }`}>
                      {activiteId === a.id && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <div>
                      <span className={`block text-[14px] font-semibold ${activiteId === a.id ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{a.label}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">Cotisations {a.tauxCotisations}% · Plafond {new Intl.NumberFormat("fr-FR").format(a.plafondCA)} €</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* CA */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-bold text-slate-700">Chiffre d&apos;affaires</label>
                <div className="flex rounded-lg bg-slate-100 p-0.5">
                  <button onClick={() => { setPeriode("mensuel"); setCa("") }} className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${periode === "mensuel" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500"}`}>Mensuel</button>
                  <button onClick={() => { setPeriode("annuel"); setCa("") }} className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${periode === "annuel" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500"}`}>Annuel</button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text" inputMode="decimal" value={ca}
                  onChange={(e) => handleCaChange(e.target.value)}
                  placeholder={periode === "mensuel" ? "3 000" : "36 000"}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-extrabold text-[#0F172A] placeholder-slate-200 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:shadow-lg focus:shadow-blue-100/40"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">€/{periode === "mensuel" ? "mois" : "an"}</span>
              </div>
            </div>

            {/* VL toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-slate-100 px-4 py-3 transition-all hover:border-slate-200">
                <div className="relative">
                  <input type="checkbox" checked={versementLiberatoire} onChange={(e) => setVersementLiberatoire(e.target.checked)} className="peer sr-only" />
                  <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#2563EB]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </div>
                <div>
                  <span className="text-[14px] font-semibold text-[#0F172A]">Versement libératoire</span>
                  <span className="block text-[11px] text-slate-400">+{activite.tauxVersementLiberatoire}% sur le CA</span>
                </div>
              </label>
            </div>

            {/* Alerte plafond */}
            <AnimatePresence>
              {depassePlafond && numCa > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                    <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-semibold text-amber-800">Plafond dépassé</p>
                      <p className="text-[12px] text-amber-700 mt-0.5">Votre CA annuel ({fmtEur(caAnnuel)}) dépasse {new Intl.NumberFormat("fr-FR").format(activite.plafondCA)} €.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Résultats */}
            <div ref={resultRef}>
              <AnimatePresence>
                {numCa > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Gauge bar */}
                    <div className="mb-4 rounded-xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold text-slate-500">Taux de charges effectif</span>
                        <span className="text-[14px] font-extrabold text-[#0F172A]">{resultMensuel.tauxEffectif}%</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${gaugePercent}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        />
                      </div>
                    </div>

                    {/* Mensuel */}
                    <div className="rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#ECFDF5] p-5 mb-3">
                      <p className="text-[12px] font-bold text-slate-500 mb-3">Résultat mensuel</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[14px]">
                          <span className="text-slate-600">Chiffre d&apos;affaires</span>
                          <span className="font-semibold">{fmtEur(caMensuel)}</span>
                        </div>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-slate-600">Cotisations ({activite.tauxCotisations}%)</span>
                          <span className="font-semibold text-red-500">-{fmtEur(resultMensuel.cotisations)}</span>
                        </div>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-slate-600">CFP ({activite.tauxCFP}%)</span>
                          <span className="font-semibold text-red-500">-{fmtEur(resultMensuel.cfp)}</span>
                        </div>
                        {resultMensuel.versementLiberatoire !== null && (
                          <div className="flex justify-between text-[14px]">
                            <span className="text-slate-600">VL ({activite.tauxVersementLiberatoire}%)</span>
                            <span className="font-semibold text-red-500">-{fmtEur(resultMensuel.versementLiberatoire)}</span>
                          </div>
                        )}
                        <div className="h-px bg-slate-200/60 my-1" />
                        <div className="flex justify-between text-[16px] pt-1">
                          <span className="font-bold text-[#0F172A]">Revenu net</span>
                          <span className="font-extrabold text-emerald-600">{fmtEur(resultMensuel.revenuNet)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Annuel */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                      <p className="text-[12px] font-bold text-slate-400 mb-3">Projection annuelle</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-white p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">CA</p>
                          <p className="mt-1 text-[14px] font-bold">{fmtEur(caAnnuel)}</p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Charges</p>
                          <p className="mt-1 text-[14px] font-bold text-red-500">-{fmtEur(resultAnnuel.totalCharges)}</p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Net</p>
                          <p className="mt-1 text-[14px] font-bold text-emerald-600">{fmtEur(resultAnnuel.revenuNet)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Copier */}
                    <button onClick={handleCopy} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-slate-400 hover:text-[#2563EB] hover:bg-slate-50 transition-all">
                      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copié !</> : <><Copy className="h-3.5 w-3.5" /> Copier le résultat</>}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {numCa > 0 && (
              <button onClick={() => setCa("")} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            )}
          </motion.div>

          {/* CTA desktop */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#ECFDF5] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Suivez votre CA en temps réel</p>
            <p className="mt-1 text-[13px] text-slate-500">Dashboard CA mensuel, factures en attente, relances automatiques.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">
              Suivre mon activité <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>

        {/* SEO */}
        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Comprendre les charges auto-entrepreneur en 2026</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>En tant qu&apos;<strong>auto-entrepreneur</strong>, vous payez des <strong>cotisations sociales proportionnelles</strong> à votre CA.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead><tr className="border-b border-slate-200"><th className="py-2 pr-4 text-left font-semibold">Activité</th><th className="py-2 px-4 text-right font-semibold">Taux</th><th className="py-2 pl-4 text-right font-semibold">Plafond</th></tr></thead>
                  <tbody>{ACTIVITES.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100"><td className="py-2.5 pr-4 text-slate-600">{a.label}</td><td className="py-2.5 px-4 text-right font-mono font-semibold">{a.tauxCotisations}%</td><td className="py-2.5 pl-4 text-right font-mono font-semibold">{new Intl.NumberFormat("fr-FR").format(a.plafondCA)} €</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[
                  { q: "Quand payer mes cotisations URSSAF ?", a: "Chaque mois ou trimestre sur autoentrepreneur.urssaf.fr. Déclaration obligatoire même si CA = 0 €." },
                  { q: "Que se passe-t-il si je dépasse le plafond ?", a: "Si dépassement 2 ans consécutifs, basculement vers le régime réel." },
                  { q: "Le versement libératoire est-il intéressant ?", a: "Intéressant si votre taux marginal d'imposition dépasse 1%-2,2%." },
                ].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50">
                    <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary>
                    <p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6">
              <h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
                  { href: "/outils/simulateur-seuil-tva", label: "Simulateur seuil TVA" },
                  { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
                  { href: "/outils/simulateur-revenu-net", label: "Simulateur revenus net" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Simulateur charges auto-entrepreneur 2026", url: "https://qonforme.fr/outils/simulateur-charges-auto-entrepreneur", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Quand payer mes cotisations URSSAF ?","acceptedAnswer":{"@type":"Answer","text":"Chaque mois ou trimestre sur autoentrepreneur.urssaf.fr. Déclaration obligatoire même si CA = 0 €."}},{"@type":"Question","name":"Que se passe-t-il si je dépasse le plafond ?","acceptedAnswer":{"@type":"Answer","text":"Si dépassement 2 ans consécutifs, basculement vers le régime réel."}},{"@type":"Question","name":"Le versement libératoire est-il intéressant ?","acceptedAnswer":{"@type":"Answer","text":"Intéressant si votre taux marginal d'imposition dépasse 1%-2,2%."}}]}) }} />
      </main>

      <OutilsCtaBar text="Suivez votre CA en temps réel" cta="Essayer →" />
      <Footer />
    </>
  )
}
