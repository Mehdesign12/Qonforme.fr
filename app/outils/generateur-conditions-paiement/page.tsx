"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Receipt, ChevronRight, Copy, Check } from "lucide-react"
import { motion } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"

const DELAIS = [
  { id: "30", label: "30 jours date de facture", text: "à 30 jours date de facture" },
  { id: "30fin", label: "30 jours fin de mois", text: "à 30 jours fin de mois" },
  { id: "45fin", label: "45 jours fin de mois", text: "à 45 jours fin de mois" },
  { id: "60", label: "60 jours date de facture", text: "à 60 jours date de facture" },
  { id: "comptant", label: "Comptant (à réception)", text: "à réception de la facture" },
]

const TAUX_OPTIONS = [
  { id: "3xbce", label: "3 × BCE (12%)", value: "trois (3) fois le taux d'intérêt légal appliqué par la Banque Centrale Européenne, soit 12,00 % l'an" },
  { id: "1xbce", label: "1 × BCE (4%)", value: "le taux d'intérêt légal appliqué par la Banque Centrale Européenne, soit 4,00 % l'an" },
  { id: "15", label: "15% (taux fixe)", value: "un taux fixe de 15,00 % l'an" },
  { id: "10", label: "10% (taux fixe)", value: "un taux fixe de 10,00 % l'an" },
]

export default function GenerateurConditionsPaiementPage() {
  const [delai, setDelai] = useState("30")
  const [taux, setTaux] = useState("3xbce")
  const [escompte, setEscompte] = useState(false)
  const [tauxEscompte, setTauxEscompte] = useState("2")
  const [rib, setRib] = useState(false)
  const [copied, setCopied] = useState(false)

  const delaiObj = DELAIS.find((d) => d.id === delai)!
  const tauxObj = TAUX_OPTIONS.find((t) => t.id === taux)!

  const generatedText = `Conditions de paiement : ${delaiObj.text}.

En cas de retard de paiement, des pénalités de retard seront appliquées au taux de ${tauxObj.value}. Ces pénalités sont exigibles de plein droit, sans qu'un rappel soit nécessaire, conformément à l'article L441-10 du Code de commerce.

Une indemnité forfaitaire pour frais de recouvrement de 40 € sera due de plein droit en cas de retard de paiement (art. D441-5 du Code de commerce).

${escompte ? `Escompte pour paiement anticipé : ${tauxEscompte} % du montant HT.` : "Pas d'escompte accordé en cas de paiement anticipé."}
${rib ? "\nMode de paiement : virement bancaire. RIB joint à la facture." : ""}`

  const handleCopy = () => { navigator.clipboard.writeText(generatedText); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <>
      <OutilsHeader breadcrumb="Conditions paiement" />
      <OutilsHero icon={<Receipt className="h-8 w-8" />} iconBg="bg-rose-50 text-rose-600" title={<>Générateur <span className="text-[#2563EB]">conditions de paiement</span></>} subtitle="Générez les mentions légales de conditions de paiement à ajouter sur vos factures et devis. Texte prêt à copier-coller." badge="Mentions légales" />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-2xl px-5 -mt-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8">
            {/* Délai */}
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Délai de paiement</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {DELAIS.map((d) => (
                  <button key={d.id} onClick={() => setDelai(d.id)} className={`rounded-xl border-2 px-4 py-2.5 text-left transition-all ${delai === d.id ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm" : "border-slate-100 hover:border-slate-200"}`}>
                    <span className={`text-[13px] font-semibold ${delai === d.id ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Taux pénalités */}
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Taux de pénalités de retard</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TAUX_OPTIONS.map((t) => (
                  <button key={t.id} onClick={() => setTaux(t.id)} className={`rounded-xl border-2 px-4 py-2.5 text-left transition-all ${taux === t.id ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm" : "border-slate-100 hover:border-slate-200"}`}>
                    <span className={`text-[13px] font-semibold ${taux === t.id ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-slate-100 px-4 py-3 transition-all hover:border-slate-200">
                <div className="relative">
                  <input type="checkbox" checked={escompte} onChange={(e) => setEscompte(e.target.checked)} className="peer sr-only" />
                  <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#2563EB]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </div>
                <div>
                  <span className="text-[14px] font-semibold text-[#0F172A]">Escompte pour paiement anticipé</span>
                  {escompte && (
                    <div className="mt-2 flex items-center gap-2">
                      <input type="number" min={0} step={0.5} value={tauxEscompte} onChange={(e) => setTauxEscompte(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-[14px] font-bold text-center outline-none focus:border-[#2563EB]" />
                      <span className="text-[13px] text-slate-500">% du montant HT</span>
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-slate-100 px-4 py-3 transition-all hover:border-slate-200">
                <div className="relative">
                  <input type="checkbox" checked={rib} onChange={(e) => setRib(e.target.checked)} className="peer sr-only" />
                  <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#2563EB]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </div>
                <span className="text-[14px] font-semibold text-[#0F172A]">Mention virement + RIB joint</span>
              </label>
            </div>

            {/* Résultat */}
            <div className="rounded-2xl bg-gradient-to-br from-[#EFF6FF] to-[#F5F3FF] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Texte généré</p>
                <button onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#2563EB] hover:bg-white/60 transition-all">
                  {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copié !</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
                </button>
              </div>
              <div className="rounded-xl bg-white/70 p-4 text-[13px] leading-relaxed text-[#0F172A] whitespace-pre-line font-medium">
                {generatedText}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Conditions intégrées automatiquement</p>
            <p className="mt-1 text-[13px] text-slate-500">Avec Qonforme, les conditions de paiement sont ajoutées automatiquement sur chaque facture.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">Automatiser <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>

        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Conditions de paiement : ce que dit la loi</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>L&apos;article L441-10 du Code de commerce impose d&apos;indiquer sur chaque facture :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Le délai de paiement</strong> — maximum 60 jours date de facture ou 45 jours fin de mois</li>
                <li><strong>Le taux de pénalités de retard</strong> — minimum : taux directeur BCE × 1 (4%), par défaut : BCE × 3 (12%)</li>
                <li><strong>L&apos;indemnité forfaitaire de recouvrement</strong> — 40 €, mentionnée obligatoirement</li>
                <li><strong>Les conditions d&apos;escompte</strong> — ou la mention « Pas d&apos;escompte accordé »</li>
              </ul>
            </div>
            <div className="mt-12"><h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[{ q: "Le délai de 60 jours est-il un maximum ?", a: "Oui, sauf accord dérogatoire interprofessionnel. Le délai par défaut (sans mention) est de 30 jours." }, { q: "Puis-je choisir n'importe quel taux de pénalités ?", a: "Le taux ne peut pas être inférieur au taux directeur BCE × 1 (4% en 2026). Par défaut, c'est BCE × 3 = 12%." }, { q: "La mention escompte est-elle obligatoire ?", a: "Oui. Si vous n'accordez pas d'escompte, la mention « Pas d'escompte accordé pour paiement anticipé » est requise." }].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p></details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6"><h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3><div className="grid gap-2 sm:grid-cols-2">
              {[{ href: "/outils/calculateur-penalites-retard", label: "Calculateur pénalités retard" }, { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" }, { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" }, { href: "/outils/generateur-numero-facture", label: "Générateur n° facture" }].map((l) => (<Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>))}
            </div></div>
          </div>
        </section>
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Générateur conditions de paiement facture", url: "https://qonforme.fr/outils/generateur-conditions-paiement", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Le délai de 60 jours est-il un maximum ?","acceptedAnswer":{"@type":"Answer","text":"Oui, sauf accord dérogatoire interprofessionnel."}},{"@type":"Question","name":"Puis-je choisir n'importe quel taux de pénalités ?","acceptedAnswer":{"@type":"Answer","text":"Le taux minimum est le taux BCE × 1 (4% en 2026)."}},{"@type":"Question","name":"La mention escompte est-elle obligatoire ?","acceptedAnswer":{"@type":"Answer","text":"Oui, même si vous n'accordez pas d'escompte."}}]}) }} />
      </main>
      <OutilsCtaBar text="Conditions auto sur vos factures" cta="Essayer →" />
      <Footer />
    </>
  )
}
