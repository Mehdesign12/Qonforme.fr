"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Shield, ChevronRight, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react"
import { motion } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"

const CRITERES = [
  { id: "format_pdf", label: "La facture est au format PDF", weight: 1, category: "Format" },
  { id: "format_facturx", label: "La facture est au format Factur-X (PDF + XML)", weight: 3, category: "Format", help: "Obligatoire à partir de sept. 2026" },
  { id: "format_en16931", label: "Le XML est conforme EN 16931", weight: 3, category: "Format", help: "Norme européenne de facturation électronique" },
  { id: "emetteur_complet", label: "Identité émetteur complète (nom, SIRET, adresse, TVA)", weight: 2, category: "Émetteur" },
  { id: "client_complet", label: "Identité client complète (nom, adresse)", weight: 2, category: "Client" },
  { id: "client_siret", label: "SIRET ou TVA du client (B2B)", weight: 1, category: "Client" },
  { id: "numero_unique", label: "Numéro de facture unique et chronologique", weight: 2, category: "Identification" },
  { id: "dates", label: "Date d'émission et date d'échéance présentes", weight: 2, category: "Identification" },
  { id: "lignes_detail", label: "Lignes détaillées (description, qté, prix HT, TVA)", weight: 2, category: "Contenu" },
  { id: "totaux", label: "Totaux HT, TVA et TTC calculés correctement", weight: 2, category: "Contenu" },
  { id: "tva_par_taux", label: "Ventilation TVA par taux applicable", weight: 1, category: "Contenu" },
  { id: "conditions_paiement", label: "Conditions de paiement (délai, mode)", weight: 1, category: "Conditions" },
  { id: "penalites_retard", label: "Mention des pénalités de retard", weight: 1, category: "Conditions" },
  { id: "indemnite_40", label: "Mention indemnité forfaitaire 40 €", weight: 1, category: "Conditions" },
  { id: "escompte", label: "Conditions d'escompte ou mention d'absence", weight: 1, category: "Conditions" },
  { id: "archivage", label: "Archivage légal garanti 10 ans", weight: 2, category: "Archivage", help: "Obligation de conservation fiscale" },
  { id: "integrite", label: "Intégrité et authenticité garanties", weight: 2, category: "Archivage", help: "Signature ou piste d'audit fiable" },
]

export default function VerificateurConformitePage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }))
  const reset = () => setChecked({})

  const totalWeight = CRITERES.reduce((s, c) => s + c.weight, 0)
  const checkedWeight = CRITERES.filter((c) => checked[c.id]).reduce((s, c) => s + c.weight, 0)
  const score = totalWeight > 0 ? Math.round((checkedWeight / totalWeight) * 100) : 0

  const categories = useMemo(() => {
    const cats = new Map<string, typeof CRITERES>()
    for (const c of CRITERES) { if (!cats.has(c.category)) cats.set(c.category, []); cats.get(c.category)!.push(c) }
    return Array.from(cats.entries())
  }, [])

  const scoreColor = score >= 90 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-500"
  const scoreBg = score >= 90 ? "from-[#ECFDF5] to-[#D1FAE5]" : score >= 60 ? "from-[#FEF3C7] to-[#FFF7ED]" : "from-[#FEE2E2] to-[#FEF2F2]"
  const scoreLabel = score >= 90 ? "Conforme" : score >= 60 ? "Partiellement conforme" : score > 0 ? "Non conforme" : "Non évalué"
  const ScoreIcon = score >= 90 ? CheckCircle2 : score >= 60 ? AlertTriangle : XCircle

  // Gauge
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <>
      <OutilsHeader breadcrumb="Conformité facture" />
      <OutilsHero icon={<Shield className="h-8 w-8" />} iconBg="bg-violet-50 text-violet-600" title={<>Vérificateur de <span className="text-[#2563EB]">conformité facture</span></>} subtitle="Évaluez la conformité de votre facture selon les critères 2026 : format, mentions, Factur-X, archivage." badge="Normes 2026" />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-2xl px-5 -mt-4">
          {/* Score gauge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className={`rounded-2xl bg-gradient-to-br ${scoreBg} p-6 mb-4 shadow-lg shadow-slate-200/30`}>
            <div className="flex items-center justify-center gap-6">
              {/* Circular gauge */}
              <div className="relative h-32 w-32 shrink-0">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/40" />
                  <motion.circle
                    cx="60" cy="60" r="54" fill="none" strokeWidth="8" strokeLinecap="round"
                    className={scoreColor}
                    stroke="currentColor"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span key={score} initial={{ scale: 0.5 }} animate={{ scale: 1 }} className={`text-[28px] font-extrabold ${scoreColor}`}>{score}%</motion.span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <ScoreIcon className={`h-5 w-5 ${scoreColor}`} />
                  <p className={`text-[16px] font-bold ${scoreColor}`}>{scoreLabel}</p>
                </div>
                <p className="mt-1 text-[13px] text-slate-500">{CRITERES.filter((c) => checked[c.id]).length} / {CRITERES.length} critères validés</p>
                {score < 90 && score > 0 && (
                  <p className="mt-2 text-[12px] text-slate-400">Les critères Factur-X et archivage ont un poids plus élevé.</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Checklist */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
            {categories.map(([cat, items], ci) => (
              <div key={cat} className={ci > 0 ? "border-t border-slate-100" : ""}>
                <div className="px-5 py-3 bg-slate-50"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{cat}</p></div>
                {items.map((c) => (
                  <button key={c.id} onClick={() => toggle(c.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100">
                    {checked[c.id] ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="h-5 w-5 shrink-0 text-slate-200" />}
                    <div className="min-w-0 flex-1">
                      <span className={`text-[14px] font-medium ${checked[c.id] ? "text-slate-500 line-through decoration-emerald-300" : "text-[#0F172A]"}`}>{c.label}</span>
                      {"help" in c && c.help && <span className="block text-[11px] text-slate-400 mt-0.5">{c.help}</span>}
                    </div>
                    {/* Weight indicator */}
                    <div className="flex gap-0.5 shrink-0">
                      {Array.from({ length: c.weight }).map((_, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${checked[c.id] ? "bg-emerald-400" : "bg-slate-200"}`} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ))}

            <div className="border-t border-slate-100 px-5 py-4">
              <button onClick={reset} className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"><RotateCcw className="h-3.5 w-3.5" /> Réinitialiser</button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">100% conforme automatiquement avec Qonforme</p>
            <p className="mt-1 text-[13px] text-slate-500">Format Factur-X EN 16931, mentions obligatoires, archivage 10 ans, intégrité garantie.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">Passer au 100% conforme <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>

        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Conformité facture 2026 : les exigences</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>En 2026, une facture conforme doit répondre à <strong>trois niveaux d&apos;exigences</strong> :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Mentions obligatoires</strong> — 21 informations requises par le Code de commerce</li>
                <li><strong>Format électronique</strong> — Factur-X EN 16931 (PDF hybride + XML structuré)</li>
                <li><strong>Archivage et intégrité</strong> — conservation 10 ans, authenticité garantie (signature ou piste d&apos;audit)</li>
              </ul>
              <p>Le format <strong>Factur-X</strong> est la norme française dérivée de la norme européenne EN 16931. Il contient un PDF lisible par l&apos;humain et un XML lisible par les logiciels comptables.</p>
            </div>
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[
                  { q: "Ma facture PDF classique est-elle conforme en 2026 ?", a: "Non. À partir de septembre 2026, les factures doivent être au format Factur-X (PDF + XML). Un simple PDF ne suffira plus." },
                  { q: "Qu'est-ce que la norme EN 16931 ?", a: "C'est la norme européenne qui définit le modèle de données sémantique pour la facturation électronique. Factur-X en est l'implémentation franco-allemande." },
                  { q: "Comment garantir l'intégrité d'une facture ?", a: "Par signature électronique qualifiée, ou par une piste d'audit fiable documentée dans vos processus internes." },
                ].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p></details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6">
              <h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[{ href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" }, { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" }, { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" }, { href: "/outils/calculateur-tva", label: "Calculateur TVA" }].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Vérificateur conformité facture 2026", url: "https://qonforme.fr/outils/verificateur-conformite-facture", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      </main>
      <OutilsCtaBar text="Factures 100% conformes 2026" cta="Essayer →" />
      <Footer />
    </>
  )
}
