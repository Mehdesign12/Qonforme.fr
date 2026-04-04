"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Calculator, ChevronRight, RotateCcw, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"

const SEUILS = [
  { id: "vente", label: "Vente de marchandises (BIC)", seuilBase: 91900, seuilMajore: 101000, plafond: 188700 },
  { id: "services", label: "Prestations de services (BIC/BNC)", seuilBase: 36800, seuilMajore: 39100, plafond: 77700 },
]

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) }

export default function SimulateurSeuilTvaPage() {
  const [activite, setActivite] = useState("services")
  const [ca, setCa] = useState("")
  const resultRef = useRef<HTMLDivElement>(null)

  const seuil = SEUILS.find((s) => s.id === activite)!
  const numCa = parseFloat(ca.replace(",", ".").replace(/\s/g, "")) || 0

  const status = useMemo(() => {
    if (numCa <= 0) return null
    if (numCa <= seuil.seuilBase) return { level: "ok", label: "Franchise en base", color: "text-emerald-600", bg: "from-[#ECFDF5] to-[#D1FAE5]", icon: CheckCircle2, message: `Vous restez sous le seuil de ${fmtEur(seuil.seuilBase)}. Pas de TVA à facturer.` }
    if (numCa <= seuil.seuilMajore) return { level: "warn", label: "Seuil majoré atteint", color: "text-amber-600", bg: "from-[#FEF3C7] to-[#FFF7ED]", icon: AlertTriangle, message: `Vous dépassez le seuil de base (${fmtEur(seuil.seuilBase)}) mais restez sous le seuil majoré (${fmtEur(seuil.seuilMajore)}). Si vous dépassez 2 années consécutives, la TVA devient obligatoire.` }
    return { level: "danger", label: "TVA obligatoire", color: "text-red-600", bg: "from-[#FEE2E2] to-[#FEF2F2]", icon: AlertTriangle, message: `Vous dépassez le seuil majoré de ${fmtEur(seuil.seuilMajore)}. Vous devez facturer la TVA dès le 1er jour du mois de dépassement.` }
  }, [numCa, seuil])

  const gaugePercent = numCa > 0 ? Math.min((numCa / seuil.seuilMajore) * 100, 120) : 0

  const handleCaChange = (v: string) => {
    setCa(v.replace(/[^0-9.,\s]/g, ""))
    setTimeout(() => { if (resultRef.current && parseFloat(v.replace(",", ".").replace(/\s/g, "")) > 0) resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, 100)
  }

  return (
    <>
      <OutilsHeader breadcrumb="Seuil TVA" />
      <OutilsHero icon={<Calculator className="h-8 w-8" />} iconBg="bg-blue-50 text-[#2563EB]" title={<>Simulateur <span className="text-[#2563EB]">seuil TVA</span></>} subtitle="Vérifiez si votre chiffre d'affaires dépasse le seuil de franchise de TVA auto-entrepreneur. Seuils 2026." badge="Seuils 2026" />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-xl px-5 -mt-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8">
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Type d&apos;activité</label>
              <div className="grid gap-2">
                {SEUILS.map((s) => (
                  <button key={s.id} onClick={() => setActivite(s.id)} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${activite === s.id ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${activite === s.id ? "border-[#2563EB] bg-[#2563EB]" : "border-slate-300"}`}>{activite === s.id && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                    <div>
                      <span className={`block text-[14px] font-semibold ${activite === s.id ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{s.label}</span>
                      <span className="block text-[11px] text-slate-400">Seuil {fmtEur(s.seuilBase)} · Majoré {fmtEur(s.seuilMajore)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Chiffre d&apos;affaires annuel</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={ca} onChange={(e) => handleCaChange(e.target.value)} placeholder="35 000" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-extrabold text-[#0F172A] placeholder-slate-200 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:shadow-lg focus:shadow-blue-100/40" autoFocus />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">€/an</span>
              </div>
            </div>

            {/* Gauge */}
            {numCa > 0 && (
              <div className="mb-5 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-slate-500">Position par rapport au seuil majoré</span>
                  <span className="text-[13px] font-extrabold text-[#0F172A]">{Math.round(gaugePercent)}%</span>
                </div>
                <div className="relative h-3 rounded-full bg-slate-200 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(gaugePercent, 100)}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className={`h-full rounded-full ${gaugePercent > 100 ? "bg-red-500" : gaugePercent > 80 ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {/* Seuil base marker */}
                  <div className="absolute top-0 h-full w-0.5 bg-amber-400" style={{ left: `${(seuil.seuilBase / seuil.seuilMajore) * 100}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                  <span>0 €</span>
                  <span>{fmtEur(seuil.seuilBase)}</span>
                  <span>{fmtEur(seuil.seuilMajore)}</span>
                </div>
              </div>
            )}

            <div ref={resultRef}>
              <AnimatePresence>
                {status && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className={`rounded-2xl bg-gradient-to-br ${status.bg} p-5`}>
                    <div className="flex items-center gap-2 mb-3">
                      <status.icon className={`h-5 w-5 ${status.color}`} />
                      <p className={`text-[15px] font-bold ${status.color}`}>{status.label}</p>
                    </div>
                    <p className="text-[14px] leading-relaxed text-slate-700">{status.message}</p>
                    {status.level === "ok" && <p className="mt-2 text-[12px] text-slate-500">Ajoutez la mention « TVA non applicable, art. 293 B du CGI » sur vos factures.</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {numCa > 0 && <button onClick={() => setCa("")} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"><RotateCcw className="h-3.5 w-3.5" /> Réinitialiser</button>}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Alertes seuil TVA automatiques</p>
            <p className="mt-1 text-[13px] text-slate-500">Qonforme surveille votre CA et vous alerte avant d&apos;atteindre le seuil.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">Activer les alertes <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>

        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Seuils de franchise TVA 2026</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>La <strong>franchise en base de TVA</strong> dispense les auto-entrepreneurs de facturer la TVA tant que leur CA annuel reste sous certains seuils :</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]"><thead><tr className="border-b border-slate-200"><th className="py-2 pr-4 text-left font-semibold">Activité</th><th className="py-2 px-4 text-right font-semibold">Seuil base</th><th className="py-2 pl-4 text-right font-semibold">Seuil majoré</th></tr></thead>
                <tbody>{SEUILS.map((s) => (<tr key={s.id} className="border-b border-slate-100"><td className="py-2.5 pr-4">{s.label}</td><td className="py-2.5 px-4 text-right font-mono font-semibold">{fmtEur(s.seuilBase)}</td><td className="py-2.5 pl-4 text-right font-mono font-semibold">{fmtEur(s.seuilMajore)}</td></tr>))}</tbody></table>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 flex gap-3"><Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" /><p className="text-[13px]">Si vous dépassez le seuil de base mais restez sous le seuil majoré, la franchise est maintenue pour l&apos;année en cours. Si le dépassement se répète l&apos;année suivante, la TVA s&apos;applique dès le 1er janvier.</p></div>
            </div>
            <div className="mt-12"><h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[{ q: "Quand dois-je commencer à facturer la TVA ?", a: "Dès le 1er jour du mois de dépassement du seuil majoré. Si vous dépassez le seuil de base 2 ans de suite, dès le 1er janvier de la 2e année." }, { q: "Dois-je rembourser la TVA sur mes anciennes factures ?", a: "Non, les factures émises avant le dépassement restent sans TVA." }, { q: "Puis-je récupérer la TVA sur mes achats ?", a: "Seulement une fois assujetti. En franchise, vous ne facturez ni ne récupérez la TVA." }].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p></details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6"><h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3><div className="grid gap-2 sm:grid-cols-2">
              {[{ href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" }, { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simulateur charges" }, { href: "/outils/simulateur-revenu-net", label: "Simulateur revenus net" }, { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" }].map((l) => (<Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>))}
            </div></div>
          </div>
        </section>
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Simulateur seuil TVA auto-entrepreneur", url: "https://qonforme.fr/outils/simulateur-seuil-tva", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Quand dois-je commencer à facturer la TVA ?","acceptedAnswer":{"@type":"Answer","text":"Dès le 1er jour du mois de dépassement du seuil majoré."}},{"@type":"Question","name":"Dois-je rembourser la TVA sur mes anciennes factures ?","acceptedAnswer":{"@type":"Answer","text":"Non, les factures émises avant le dépassement restent sans TVA."}},{"@type":"Question","name":"Puis-je récupérer la TVA sur mes achats ?","acceptedAnswer":{"@type":"Answer","text":"Seulement une fois assujetti à la TVA."}}]}) }} />
      </main>
      <OutilsCtaBar text="Alertes seuil TVA auto" cta="Activer →" />
      <Footer />
    </>
  )
}
