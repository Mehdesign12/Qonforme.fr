"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Calculator, ArrowLeftRight, RotateCcw, ChevronRight } from "lucide-react"
import { motion } from "motion/react"
import Footer from "@/components/layout/Footer"
import { TVA_RATES, htToTtc, ttcToHt, calculateVat } from "@/lib/outils/tva"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

export default function CalculateurTvaPage() {
  const [mode, setMode] = useState<"ht-to-ttc" | "ttc-to-ht">("ht-to-ttc")
  const [amount, setAmount] = useState("")
  const [rateIndex, setRateIndex] = useState(0)

  const rate = TVA_RATES[rateIndex].value
  const numAmount = parseFloat(amount.replace(",", ".")) || 0

  const result = useCallback(() => {
    if (numAmount <= 0) return null
    if (mode === "ht-to-ttc") {
      return {
        ht: numAmount,
        tva: calculateVat(numAmount, rate),
        ttc: htToTtc(numAmount, rate),
      }
    }
    const ht = ttcToHt(numAmount, rate)
    return {
      ht,
      tva: calculateVat(ht, rate),
      ttc: numAmount,
    }
  }, [numAmount, rate, mode])()

  const handleSwapMode = () => {
    setMode((m) => (m === "ht-to-ttc" ? "ttc-to-ht" : "ht-to-ttc"))
    setAmount("")
  }

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
            <span className="text-slate-600 font-medium">Calculateur TVA</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="mx-auto max-w-3xl px-5 pt-8 pb-6 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
            <Calculator className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Calculateur TVA HT ↔ TTC
          </h1>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Convertissez instantanément vos montants HT en TTC et inversement. Tous les taux de TVA français : 20%, 10%, 5,5%, 2,1%.
          </p>
        </section>

        {/* Outil */}
        <section className="mx-auto max-w-xl px-5 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            {/* Mode toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-1">
                <button
                  onClick={() => { setMode("ht-to-ttc"); setAmount("") }}
                  className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all ${mode === "ht-to-ttc" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  HT → TTC
                </button>
                <button
                  onClick={() => { setMode("ttc-to-ht"); setAmount("") }}
                  className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all ${mode === "ttc-to-ht" ? "bg-white text-[#0F172A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  TTC → HT
                </button>
              </div>
              <button onClick={handleSwapMode} className="flex items-center gap-1 text-[12px] font-medium text-slate-400 hover:text-[#2563EB] transition-colors" title="Inverser">
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Montant */}
            <div className="mb-5">
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Montant {mode === "ht-to-ttc" ? "HT" : "TTC"} (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder={mode === "ht-to-ttc" ? "Ex : 1000" : "Ex : 1200"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-[#0F172A] placeholder-slate-300 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
                autoFocus
              />
            </div>

            {/* Taux TVA */}
            <div className="mb-6">
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Taux de TVA
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TVA_RATES.map((r, i) => (
                  <button
                    key={r.value}
                    onClick={() => setRateIndex(i)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                      rateIndex === i
                        ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="block text-[14px] font-bold">{r.value}%</span>
                    <span className="block text-[11px] opacity-70">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Résultat */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#F5F3FF] p-5"
              >
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">HT</p>
                    <p className="mt-1 text-lg font-extrabold text-[#0F172A]">{fmtEur(result.ht)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">TVA ({rate}%)</p>
                    <p className="mt-1 text-lg font-extrabold text-[#2563EB]">{fmtEur(result.tva)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">TTC</p>
                    <p className="mt-1 text-lg font-extrabold text-[#0F172A]">{fmtEur(result.ttc)}</p>
                  </div>
                </div>
              </motion.div>
            )}

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

          {/* CTA */}
          <div className="mt-8 rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Vous facturez souvent avec la TVA ?</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Qonforme calcule automatiquement la TVA sur chaque facture et génère le Factur-X conforme 2026.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Automatiser mes factures <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Contenu SEO */}
        <section className="border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Comment calculer la TVA ?</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>
                La <strong>Taxe sur la Valeur Ajoutée (TVA)</strong> est un impôt indirect sur la consommation, collecté par les entreprises pour le compte de l&apos;État. En France, il existe quatre taux de TVA :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>20% (taux normal)</strong> — applicable à la majorité des biens et services</li>
                <li><strong>10% (taux intermédiaire)</strong> — restauration, transports, travaux de rénovation</li>
                <li><strong>5,5% (taux réduit)</strong> — alimentation, énergie, livres, spectacles vivants</li>
                <li><strong>2,1% (taux super-réduit)</strong> — presse, médicaments remboursés par la Sécurité sociale</li>
              </ul>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Formules de calcul</h3>
              <div className="rounded-xl bg-slate-50 p-4 font-mono text-[14px]">
                <p><strong>HT → TTC :</strong> Montant TTC = Montant HT × (1 + Taux TVA / 100)</p>
                <p className="mt-2"><strong>TTC → HT :</strong> Montant HT = Montant TTC / (1 + Taux TVA / 100)</p>
                <p className="mt-2"><strong>Montant TVA :</strong> TVA = Montant HT × (Taux TVA / 100)</p>
              </div>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Exemple</h3>
              <p>
                Pour un montant HT de <strong>1 000 €</strong> avec un taux de TVA de <strong>20%</strong> :
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>TVA = 1 000 × 0,20 = <strong>200 €</strong></li>
                <li>TTC = 1 000 + 200 = <strong>1 200 €</strong></li>
              </ul>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Auto-entrepreneurs et TVA</h3>
              <p>
                Les auto-entrepreneurs bénéficient de la <strong>franchise en base de TVA</strong> tant que leur chiffre d&apos;affaires ne dépasse pas certains seuils (188 700 € pour la vente, 77 700 € pour les services). Au-delà, ils doivent facturer et reverser la TVA.
              </p>
            </div>

            {/* FAQ */}
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-4">
                {[
                  {
                    q: "Comment passer du HT au TTC ?",
                    a: "Multipliez le montant HT par (1 + taux de TVA). Pour un taux de 20%, multipliez par 1,20. Exemple : 500 € HT × 1,20 = 600 € TTC.",
                  },
                  {
                    q: "Comment retrouver le HT à partir du TTC ?",
                    a: "Divisez le montant TTC par (1 + taux de TVA). Pour un taux de 20%, divisez par 1,20. Exemple : 600 € TTC / 1,20 = 500 € HT.",
                  },
                  {
                    q: "Quel taux de TVA appliquer sur mes factures ?",
                    a: "Le taux dépend de la nature de votre activité et du produit/service vendu. Le taux normal est de 20%. Consultez le site des impôts (impots.gouv.fr) pour vérifier le taux applicable à votre activité.",
                  },
                  {
                    q: "Un auto-entrepreneur doit-il facturer la TVA ?",
                    a: "Non, tant que son CA reste sous les seuils de franchise (188 700 € pour la vente, 77 700 € pour les services). La mention « TVA non applicable, art. 293 B du CGI » doit alors figurer sur chaque facture.",
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
                <Link href="/outils/simulateur-charges-auto-entrepreneur" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Simulateur charges auto-entrepreneur
                </Link>
                <Link href="/outils/simulateur-seuil-tva" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Simulateur seuil TVA
                </Link>
                <Link href="/outils/generateur-facture-gratuite" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Générateur de facture gratuit
                </Link>
                <Link href="/guide/tva-auto-entrepreneur" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Guide TVA auto-entrepreneur
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
              name: "Calculateur TVA HT TTC gratuit",
              description: "Convertissez instantanément vos montants HT en TTC et inversement avec les 4 taux de TVA français.",
              url: "https://qonforme.fr/outils/calculateur-tva",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
              },
              author: {
                "@type": "Organization",
                name: "Qonforme",
                url: "https://qonforme.fr",
              },
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
                {
                  "@type": "Question",
                  name: "Comment passer du HT au TTC ?",
                  acceptedAnswer: { "@type": "Answer", text: "Multipliez le montant HT par (1 + taux de TVA). Pour un taux de 20%, multipliez par 1,20." },
                },
                {
                  "@type": "Question",
                  name: "Comment retrouver le HT à partir du TTC ?",
                  acceptedAnswer: { "@type": "Answer", text: "Divisez le montant TTC par (1 + taux de TVA). Pour un taux de 20%, divisez par 1,20." },
                },
                {
                  "@type": "Question",
                  name: "Un auto-entrepreneur doit-il facturer la TVA ?",
                  acceptedAnswer: { "@type": "Answer", text: "Non, tant que son CA reste sous les seuils de franchise (188 700 € pour la vente, 77 700 € pour les services)." },
                },
              ],
            }),
          }}
        />
      </main>

      <Footer />
    </>
  )
}
