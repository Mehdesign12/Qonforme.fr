"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight, FileCheck, ChevronRight, CheckCircle2, XCircle, RotateCcw } from "lucide-react"
import { motion } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"

const MENTIONS = [
  { id: "emetteur_nom", label: "Nom / raison sociale de l'émetteur", category: "Émetteur", obligatoire: true },
  { id: "emetteur_adresse", label: "Adresse de l'émetteur", category: "Émetteur", obligatoire: true },
  { id: "emetteur_siret", label: "Numéro SIRET de l'émetteur", category: "Émetteur", obligatoire: true },
  { id: "emetteur_rcs", label: "N° RCS et ville du greffe (sociétés)", category: "Émetteur", obligatoire: true },
  { id: "emetteur_tva", label: "N° TVA intracommunautaire (si assujetti)", category: "Émetteur", obligatoire: true },
  { id: "client_nom", label: "Nom / raison sociale du client", category: "Client", obligatoire: true },
  { id: "client_adresse", label: "Adresse du client", category: "Client", obligatoire: true },
  { id: "client_adresse_livraison", label: "Adresse de livraison (si différente)", category: "Client", obligatoire: false },
  { id: "numero", label: "Numéro de facture (unique, chronologique)", category: "Facture", obligatoire: true },
  { id: "date_emission", label: "Date d'émission", category: "Facture", obligatoire: true },
  { id: "date_echeance", label: "Date d'échéance / délai de paiement", category: "Facture", obligatoire: true },
  { id: "designation", label: "Désignation des produits/services", category: "Lignes", obligatoire: true },
  { id: "quantite", label: "Quantité de chaque produit/service", category: "Lignes", obligatoire: true },
  { id: "prix_unitaire", label: "Prix unitaire HT", category: "Lignes", obligatoire: true },
  { id: "taux_tva", label: "Taux de TVA applicable (par ligne)", category: "Montants", obligatoire: true },
  { id: "total_ht", label: "Montant total HT", category: "Montants", obligatoire: true },
  { id: "total_tva", label: "Montant total de la TVA", category: "Montants", obligatoire: true },
  { id: "total_ttc", label: "Montant total TTC", category: "Montants", obligatoire: true },
  { id: "penalites", label: "Taux de pénalités de retard", category: "Conditions", obligatoire: true },
  { id: "indemnite", label: "Indemnité forfaitaire de recouvrement (40 €)", category: "Conditions", obligatoire: true },
  { id: "escompte", label: "Conditions d'escompte (ou mention d'absence)", category: "Conditions", obligatoire: true },
  { id: "mention_tva_ae", label: "Mention TVA non applicable art. 293 B (si AE)", category: "Spécifique", obligatoire: false },
  { id: "mention_autoliquidation", label: "Mention autoliquidation TVA (si applicable)", category: "Spécifique", obligatoire: false },
]

export default function VerificateurMentionsPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }))
  const reset = () => setChecked({})

  const obligatoires = MENTIONS.filter((m) => m.obligatoire)
  const checkedObligatoires = obligatoires.filter((m) => checked[m.id])
  const score = obligatoires.length > 0 ? Math.round((checkedObligatoires.length / obligatoires.length) * 100) : 0

  const categories = useMemo(() => {
    const cats = new Map<string, typeof MENTIONS>()
    for (const m of MENTIONS) { if (!cats.has(m.category)) cats.set(m.category, []); cats.get(m.category)!.push(m) }
    return Array.from(cats.entries())
  }, [])

  const scoreColor = score === 100 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-red-500"
  const scoreBg = score === 100 ? "from-[#ECFDF5] to-[#D1FAE5]" : score >= 70 ? "from-[#FEF3C7] to-[#FFF7ED]" : "from-[#FEE2E2] to-[#FEF2F2]"

  return (
    <>
      <OutilsHeader breadcrumb="Mentions facture" />
      <OutilsHero icon={<FileCheck className="h-8 w-8" />} iconBg="bg-emerald-50 text-emerald-600" title={<>Vérificateur <span className="text-[#2563EB]">mentions obligatoires</span></>} subtitle="Cochez chaque mention présente sur votre facture. Obtenez votre score de conformité instantanément." badge="Réglementation 2026" />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-2xl px-5 -mt-4">
          {/* Score */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className={`rounded-2xl bg-gradient-to-br ${scoreBg} p-5 mb-4 text-center shadow-lg shadow-slate-200/30`}>
            <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Score de conformité</p>
            <motion.p key={score} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className={`mt-1 text-[48px] font-extrabold ${scoreColor}`}>{score}%</motion.p>
            <p className="text-[13px] text-slate-500">{checkedObligatoires.length} / {obligatoires.length} mentions obligatoires</p>
            {score === 100 && <p className="mt-2 text-[14px] font-semibold text-emerald-600">✓ Votre facture contient toutes les mentions obligatoires !</p>}
          </motion.div>

          {/* Checklist */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden">
            {categories.map(([cat, items], ci) => (
              <div key={cat} className={ci > 0 ? "border-t border-slate-100" : ""}>
                <div className="px-5 py-3 bg-slate-50"><p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{cat}</p></div>
                {items.map((m) => (
                  <button key={m.id} onClick={() => toggle(m.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100">
                    {checked[m.id] ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="h-5 w-5 shrink-0 text-slate-200" />}
                    <div className="min-w-0">
                      <span className={`text-[14px] font-medium ${checked[m.id] ? "text-[#0F172A] line-through decoration-emerald-300" : "text-[#0F172A]"}`}>{m.label}</span>
                      {m.obligatoire && !checked[m.id] && <span className="ml-2 text-[10px] font-bold text-red-400 uppercase">Obligatoire</span>}
                      {!m.obligatoire && <span className="ml-2 text-[10px] font-bold text-slate-300 uppercase">Optionnel</span>}
                    </div>
                  </button>
                ))}
              </div>
            ))}

            <div className="border-t border-slate-100 px-5 py-4">
              <button onClick={reset} className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"><RotateCcw className="h-3.5 w-3.5" /> Réinitialiser</button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#ECFDF5] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Toutes ces mentions sont automatiques avec Qonforme</p>
            <p className="mt-1 text-[13px] text-slate-500">Chaque facture générée inclut les 21 mentions obligatoires + le format Factur-X EN 16931.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">Automatiser mes factures <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>

        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Mentions obligatoires sur une facture en 2026</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>La réglementation française impose <strong>21 mentions obligatoires</strong> sur chaque facture. L&apos;absence d&apos;une mention peut entraîner une amende de <strong>15 € par mention manquante</strong> (art. 1737 du CGI), plafonnée à 25% du montant de la facture.</p>
              <p>À partir de 2026, les factures devront en plus être au format <strong>Factur-X</strong> (PDF hybride avec XML structuré).</p>
            </div>
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[
                  { q: "Quelle amende pour une mention manquante ?", a: "15 € par mention manquante et par facture, plafonné à 25% du montant (art. 1737 CGI)." },
                  { q: "L'indemnité de recouvrement de 40 € est-elle obligatoire ?", a: "Oui, la mention de cette indemnité doit figurer sur toute facture B2B depuis 2013." },
                  { q: "Un auto-entrepreneur a-t-il les mêmes obligations ?", a: "Oui, plus la mention spécifique « TVA non applicable, art. 293 B du CGI » s'il est en franchise." },
                ].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p></details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6">
              <h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {[{ href: "/outils/verificateur-conformite-facture", label: "Vérificateur conformité facture" }, { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" }, { href: "/outils/calculateur-penalites-retard", label: "Calculateur pénalités retard" }, { href: "/outils/generateur-conditions-paiement", label: "Générateur conditions paiement" }].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Vérificateur mentions obligatoires facture", url: "https://qonforme.fr/outils/verificateur-mentions-facture", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Quelle amende pour une mention manquante ?","acceptedAnswer":{"@type":"Answer","text":"15 € par mention et par facture, plafonné à 25% du montant."}},{"@type":"Question","name":"L'indemnité de 40 € est-elle obligatoire ?","acceptedAnswer":{"@type":"Answer","text":"Oui, la mention doit figurer sur toute facture B2B depuis 2013."}},{"@type":"Question","name":"Un auto-entrepreneur a-t-il les mêmes obligations ?","acceptedAnswer":{"@type":"Answer","text":"Oui, plus la mention TVA non applicable art. 293 B du CGI."}}]}) }} />
      </main>
      <OutilsCtaBar text="21 mentions auto sur vos factures" cta="Essayer →" />
      <Footer />
    </>
  )
}
