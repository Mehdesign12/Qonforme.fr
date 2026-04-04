"use client"

import { useState, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Calculator, ArrowLeftRight, RotateCcw, ChevronRight, Copy, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { TVA_RATES, htToTtc, ttcToHt, calculateVat } from "@/lib/outils/tva"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

export default function CalculateurTvaPage() {
  const [mode, setMode] = useState<"ht-to-ttc" | "ttc-to-ht">("ht-to-ttc")
  const [amount, setAmount] = useState("")
  const [rateIndex, setRateIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const rate = TVA_RATES[rateIndex].value
  const numAmount = parseFloat(amount.replace(",", ".")) || 0

  const result = useCallback(() => {
    if (numAmount <= 0) return null
    if (mode === "ht-to-ttc") {
      return { ht: numAmount, tva: calculateVat(numAmount, rate), ttc: htToTtc(numAmount, rate) }
    }
    const ht = ttcToHt(numAmount, rate)
    return { ht, tva: calculateVat(ht, rate), ttc: numAmount }
  }, [numAmount, rate, mode])()

  const handleSwapMode = () => {
    setMode((m) => (m === "ht-to-ttc" ? "ttc-to-ht" : "ht-to-ttc"))
    setAmount("")
  }

  const handleCopy = () => {
    if (!result) return
    const text = `HT: ${fmtEur(result.ht)} | TVA (${rate}%): ${fmtEur(result.tva)} | TTC: ${fmtEur(result.ttc)}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAmountChange = (v: string) => {
    setAmount(v.replace(/[^0-9.,]/g, ""))
    // Scroll to result on mobile after a short delay
    setTimeout(() => {
      if (resultRef.current && parseFloat(v.replace(",", ".")) > 0) {
        resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }, 100)
  }

  return (
    <>
      <OutilsHeader breadcrumb="Calculateur TVA" />

      <OutilsHero
        icon={<Calculator className="h-8 w-8" />}
        iconBg="bg-blue-50 text-[#2563EB]"
        title={<>Calculateur TVA <span className="text-[#2563EB]">HT ↔ TTC</span></>}
        subtitle="Convertissez instantanément vos montants HT en TTC et inversement. Tous les taux de TVA français : 20%, 10%, 5,5%, 2,1%."
        badge="100% gratuit"
      />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        {/* Outil */}
        <section className="mx-auto max-w-xl px-5 -mt-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8"
          >
            {/* Mode toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => { setMode("ht-to-ttc"); setAmount("") }}
                  className={`rounded-lg px-4 py-2.5 text-[13px] font-bold transition-all ${mode === "ht-to-ttc" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  HT → TTC
                </button>
                <button
                  onClick={() => { setMode("ttc-to-ht"); setAmount("") }}
                  className={`rounded-lg px-4 py-2.5 text-[13px] font-bold transition-all ${mode === "ttc-to-ht" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  TTC → HT
                </button>
              </div>
              <button onClick={handleSwapMode} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all" title="Inverser">
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>

            {/* Montant */}
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">
                Montant {mode === "ht-to-ttc" ? "HT" : "TTC"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder={mode === "ht-to-ttc" ? "1 000" : "1 200"}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-2xl font-extrabold text-[#0F172A] placeholder-slate-200 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:shadow-lg focus:shadow-blue-100/40"
                  autoFocus
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">€</span>
              </div>
            </div>

            {/* Taux TVA — 1 colonne mobile, 2 desktop */}
            <div className="mb-6">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Taux de TVA</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TVA_RATES.map((r, i) => (
                  <button
                    key={r.value}
                    onClick={() => setRateIndex(i)}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      rateIndex === i
                        ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[14px] font-extrabold ${
                      rateIndex === i ? "bg-[#2563EB] text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {r.value}%
                    </span>
                    <span className={`text-[13px] leading-tight ${rateIndex === i ? "text-[#2563EB] font-semibold" : "text-slate-500"}`}>
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Résultat */}
            <div ref={resultRef}>
              <AnimatePresence mode="wait">
                {result && (
                  <motion.div
                    key={`${result.ht}-${result.ttc}-${rate}`}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-2xl bg-gradient-to-br from-[#EFF6FF] via-[#F5F3FF] to-[#ECFDF5] p-5 sm:p-6"
                  >
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl bg-white/60 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">HT</p>
                        <p className="mt-1 text-[17px] font-extrabold text-[#0F172A] sm:text-xl">{fmtEur(result.ht)}</p>
                      </div>
                      <div className="rounded-xl bg-white/60 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">TVA {rate}%</p>
                        <p className="mt-1 text-[17px] font-extrabold text-[#2563EB] sm:text-xl">{fmtEur(result.tva)}</p>
                      </div>
                      <div className="rounded-xl bg-white/60 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">TTC</p>
                        <p className="mt-1 text-[17px] font-extrabold text-[#0F172A] sm:text-xl">{fmtEur(result.ttc)}</p>
                      </div>
                    </div>

                    {/* Copier */}
                    <button
                      onClick={handleCopy}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-slate-400 hover:text-[#2563EB] hover:bg-white/60 transition-all"
                    >
                      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copié !</> : <><Copy className="h-3.5 w-3.5" /> Copier le résultat</>}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Reset */}
            {numAmount > 0 && (
              <button
                onClick={() => setAmount("")}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            )}
          </motion.div>

          {/* CTA desktop */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center"
          >
            <p className="text-[15px] font-bold text-[#0F172A]">Vous facturez souvent avec la TVA ?</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Qonforme calcule automatiquement la TVA sur chaque facture et génère le Factur-X conforme 2026.
            </p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">
              Automatiser mes factures <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>

        {/* Contenu SEO */}
        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Comment calculer la TVA ?</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>La <strong>Taxe sur la Valeur Ajoutée (TVA)</strong> est un impôt indirect sur la consommation. En France, il existe quatre taux :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>20% (taux normal)</strong> — majorité des biens et services</li>
                <li><strong>10% (taux intermédiaire)</strong> — restauration, transports, travaux</li>
                <li><strong>5,5% (taux réduit)</strong> — alimentation, énergie, livres</li>
                <li><strong>2,1% (taux super-réduit)</strong> — presse, médicaments remboursés</li>
              </ul>
              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Formules</h3>
              <div className="rounded-xl bg-slate-50 p-4 font-mono text-[14px]">
                <p><strong>HT → TTC :</strong> Montant TTC = Montant HT × (1 + Taux / 100)</p>
                <p className="mt-2"><strong>TTC → HT :</strong> Montant HT = Montant TTC / (1 + Taux / 100)</p>
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Auto-entrepreneurs et TVA</h3>
              <p>Les auto-entrepreneurs bénéficient de la <strong>franchise en base de TVA</strong> tant que leur CA ne dépasse pas les seuils (188 700 € vente, 77 700 € services).</p>
            </div>

            {/* FAQ */}
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[
                  { q: "Comment passer du HT au TTC ?", a: "Multipliez le montant HT par (1 + taux de TVA). Pour 20%, multipliez par 1,20. Exemple : 500 € HT × 1,20 = 600 € TTC." },
                  { q: "Comment retrouver le HT à partir du TTC ?", a: "Divisez le montant TTC par (1 + taux de TVA). Pour 20%, divisez par 1,20. Exemple : 600 € TTC / 1,20 = 500 € HT." },
                  { q: "Quel taux de TVA appliquer sur mes factures ?", a: "Le taux dépend de la nature de votre activité. Le taux normal est 20%. Consultez impots.gouv.fr pour votre cas." },
                  { q: "Un auto-entrepreneur doit-il facturer la TVA ?", a: "Non, tant que son CA reste sous les seuils de franchise. La mention « TVA non applicable, art. 293 B du CGI » doit figurer sur chaque facture." },
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
                {[
                  { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simulateur charges auto-entrepreneur" },
                  { href: "/outils/simulateur-seuil-tva", label: "Simulateur seuil TVA" },
                  { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
                  { href: "/guide/tva-auto-entrepreneur", label: "Guide TVA auto-entrepreneur" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                    <span className="text-[#2563EB]">→</span> {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* JSON-LD */}
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "WebApplication",
          name: "Calculateur TVA HT TTC gratuit", description: "Convertissez instantanément vos montants HT en TTC et inversement avec les 4 taux de TVA français.",
          url: "https://qonforme.fr/outils/calculateur-tva", applicationCategory: "BusinessApplication", operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          author: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
        })}} />
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Comment passer du HT au TTC ?", acceptedAnswer: { "@type": "Answer", text: "Multipliez le montant HT par (1 + taux de TVA). Pour 20%, multipliez par 1,20." } },
            { "@type": "Question", name: "Un auto-entrepreneur doit-il facturer la TVA ?", acceptedAnswer: { "@type": "Answer", text: "Non, tant que son CA reste sous les seuils de franchise (188 700 € vente, 77 700 € services)." } },
          ],
        })}} />
      </main>

      {/* CTA sticky mobile */}
      <OutilsCtaBar text="TVA auto sur vos factures Factur-X" cta="Automatiser →" />

      <Footer />
    </>
  )
}
