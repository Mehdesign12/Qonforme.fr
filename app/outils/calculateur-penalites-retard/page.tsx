"use client"

import { useState, useMemo, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Scale, ChevronRight, RotateCcw, Copy, Check, AlertTriangle } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { calculerPenalites, joursEntre, TAUX_BCE, INDEMNITE_FORFAITAIRE } from "@/lib/outils/penalites"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n) }

export default function CalculateurPenalitesPage() {
  const [montant, setMontant] = useState("")
  const [dateEcheance, setDateEcheance] = useState("")
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().slice(0, 10))
  const [tauxCustom, setTauxCustom] = useState("")
  const [copied, setCopied] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const numMontant = parseFloat(montant.replace(",", ".").replace(/\s/g, "")) || 0
  const jours = dateEcheance && datePaiement ? joursEntre(dateEcheance, datePaiement) : 0
  const tauxAnnuel = tauxCustom ? parseFloat(tauxCustom.replace(",", ".")) : undefined

  const result = useMemo(() => {
    if (numMontant <= 0 || jours <= 0) return null
    return calculerPenalites(numMontant, jours, tauxAnnuel)
  }, [numMontant, jours, tauxAnnuel])

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(`Intérêts de retard : ${fmtEur(result.interetsRetard)} | Indemnité forfaitaire : ${fmtEur(INDEMNITE_FORFAITAIRE)} | Total : ${fmtEur(result.totalDu)}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const inputClass = "w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-medium text-[#0F172A] placeholder-slate-300 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-blue-100"

  return (
    <>
      <OutilsHeader breadcrumb="Pénalités de retard" />
      <OutilsHero icon={<Scale className="h-8 w-8" />} iconBg="bg-amber-50 text-amber-600" title={<>Calculateur <span className="text-[#2563EB]">pénalités de retard</span></>} subtitle="Calculez les intérêts de retard et l'indemnité forfaitaire de recouvrement (40 €) pour vos factures impayées." badge="Taux BCE 2026" />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-xl px-5 -mt-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[13px] font-bold text-slate-700">Montant TTC de la facture</label>
                <div className="relative">
                  <input type="text" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value.replace(/[^0-9.,\s]/g, ""))} placeholder="5 000" className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-extrabold text-[#0F172A] placeholder-slate-200 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:shadow-lg focus:shadow-blue-100/40" autoFocus />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">€</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-2 block text-[13px] font-bold text-slate-700">Date d&apos;échéance</label><input type="date" className={inputClass} value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} /></div>
                <div><label className="mb-2 block text-[13px] font-bold text-slate-700">Date de paiement</label><input type="date" className={inputClass} value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} /></div>
              </div>

              {jours > 0 && <p className="text-center text-[13px] font-semibold text-amber-600"><AlertTriangle className="inline h-3.5 w-3.5 mr-1" />{jours} jour{jours > 1 ? "s" : ""} de retard</p>}

              <div>
                <label className="mb-2 block text-[13px] font-bold text-slate-700">Taux annuel (optionnel)</label>
                <div className="flex items-center gap-3">
                  <input type="text" inputMode="decimal" className={inputClass} value={tauxCustom} onChange={(e) => setTauxCustom(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder={`${TAUX_BCE * 3}% (BCE × 3 par défaut)`} />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Par défaut : taux BCE ({TAUX_BCE}%) × 3 = {TAUX_BCE * 3}%. Minimum légal : taux BCE × 1.</p>
              </div>
            </div>

            {/* Résultat */}
            <div ref={resultRef}>
              <AnimatePresence>
                {result && (
                  <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-6 rounded-2xl bg-gradient-to-br from-[#FEF3C7] via-[#FFF7ED] to-[#FEF3C7] p-5 sm:p-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-[14px]"><span className="text-slate-600">Montant facture</span><span className="font-semibold">{fmtEur(result.montantFacture)}</span></div>
                      <div className="flex justify-between text-[14px]"><span className="text-slate-600">Jours de retard</span><span className="font-semibold">{result.joursRetard} jours</span></div>
                      <div className="flex justify-between text-[14px]"><span className="text-slate-600">Taux annuel</span><span className="font-semibold">{result.tauxAnnuel}%</span></div>
                      <div className="h-px bg-amber-200/60 my-1" />
                      <div className="flex justify-between text-[14px]"><span className="text-slate-600">Intérêts de retard</span><span className="font-bold text-amber-700">{fmtEur(result.interetsRetard)}</span></div>
                      <div className="flex justify-between text-[14px]"><span className="text-slate-600">Indemnité forfaitaire</span><span className="font-bold text-amber-700">{fmtEur(INDEMNITE_FORFAITAIRE)}</span></div>
                      <div className="h-px bg-amber-200/60 my-1" />
                      <div className="flex justify-between text-[18px]"><span className="font-bold text-[#0F172A]">Total dû par le client</span><span className="font-extrabold text-amber-600">{fmtEur(result.totalDu)}</span></div>
                    </div>
                    <button onClick={handleCopy} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-amber-600/60 hover:text-amber-700 hover:bg-white/60 transition-all">
                      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copié !</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {numMontant > 0 && <button onClick={() => { setMontant(""); setDateEcheance(""); setTauxCustom("") }} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"><RotateCcw className="h-3.5 w-3.5" /> Réinitialiser</button>}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#FEF3C7] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Relances automatiques J+30 et J+45</p>
            <p className="mt-1 text-[13px] text-slate-500">Qonforme envoie des rappels à vos clients avant même que les pénalités ne s&apos;appliquent.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">Activer les relances <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>

        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Pénalités de retard : ce que dit la loi</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>L&apos;article L441-10 du Code de commerce impose deux types de pénalités en cas de retard de paiement :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Intérêts de retard</strong> — calculés sur le montant TTC, au taux annuel convenu (minimum : taux BCE × 1, par défaut : taux BCE × 3)</li>
                <li><strong>Indemnité forfaitaire de recouvrement</strong> — 40 € par facture, due de plein droit sans mise en demeure</li>
              </ul>
              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Formule de calcul</h3>
              <div className="rounded-xl bg-slate-50 p-4 font-mono text-[14px]">
                <p><strong>Intérêts</strong> = Montant TTC × (Taux annuel / 100) × (Jours retard / 365)</p>
                <p className="mt-1"><strong>Total</strong> = Intérêts + 40 € (indemnité forfaitaire)</p>
              </div>
            </div>
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[
                  { q: "L'indemnité de 40 € est-elle par facture ou globale ?", a: "Par facture. Si un client a 3 factures en retard, il doit 3 × 40 € = 120 € d'indemnité forfaitaire." },
                  { q: "Dois-je envoyer une mise en demeure avant ?", a: "Non, les pénalités de retard sont exigibles de plein droit, sans mise en demeure préalable (art. L441-10)." },
                  { q: "Quel taux appliquer si rien n'est précisé dans mes CGV ?", a: "Le taux légal par défaut est le taux directeur de la BCE × 3 (soit 12% en 2026)." },
                ].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p></details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6">
              <h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[{ href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" }, { href: "/outils/generateur-conditions-paiement", label: "Générateur conditions paiement" }, { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" }, { href: "/outils/calculateur-tva", label: "Calculateur TVA" }].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Calculateur pénalités de retard facture", url: "https://qonforme.fr/outils/calculateur-penalites-retard", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      </main>
      <OutilsCtaBar text="Relances auto J+30/J+45" cta="Activer →" />
      <Footer />
    </>
  )
}
