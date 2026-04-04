"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Hash, ChevronRight, Copy, Check } from "lucide-react"
import { motion } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"

const FORMATS = [
  { id: "standard", label: "F-AAAA-NNN", example: "F-2026-001", desc: "Format classique avec préfixe + année + compteur" },
  { id: "compact", label: "AAAAMMNNN", example: "202604001", desc: "Année + mois + compteur (sans séparateur)" },
  { id: "prefix", label: "PRE-NNN", example: "FAC-001", desc: "Préfixe personnalisé + compteur" },
  { id: "full", label: "PRE-AAAA-MM-NNN", example: "FAC-2026-04-001", desc: "Préfixe + année + mois + compteur" },
]

export default function GenerateurNumeroFacturePage() {
  const [format, setFormat] = useState("standard")
  const [prefixe, setPrefixe] = useState("F")
  const [annee, setAnnee] = useState(new Date().getFullYear().toString())
  const [mois, setMois] = useState((new Date().getMonth() + 1).toString().padStart(2, "0"))
  const [compteur, setCompteur] = useState("1")
  const [digits, setDigits] = useState("3")
  const [copied, setCopied] = useState("")

  const numCompteur = parseInt(compteur) || 1
  const numDigits = parseInt(digits) || 3
  const paddedCompteur = numCompteur.toString().padStart(numDigits, "0")

  const generateNumero = (): string => {
    switch (format) {
      case "standard": return `${prefixe}-${annee}-${paddedCompteur}`
      case "compact": return `${annee}${mois}${paddedCompteur}`
      case "prefix": return `${prefixe}-${paddedCompteur}`
      case "full": return `${prefixe}-${annee}-${mois}-${paddedCompteur}`
      default: return paddedCompteur
    }
  }

  const numero = generateNumero()

  // Generate sequence preview
  const sequence = Array.from({ length: 5 }, (_, i) => {
    const n = (numCompteur + i).toString().padStart(numDigits, "0")
    switch (format) {
      case "standard": return `${prefixe}-${annee}-${n}`
      case "compact": return `${annee}${mois}${n}`
      case "prefix": return `${prefixe}-${n}`
      case "full": return `${prefixe}-${annee}-${mois}-${n}`
      default: return n
    }
  })

  const handleCopy = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 2000) }

  return (
    <>
      <OutilsHeader breadcrumb="N° facture" />
      <OutilsHero icon={<Hash className="h-8 w-8" />} iconBg="bg-slate-100 text-slate-600" title={<>Générateur <span className="text-[#2563EB]">n° de facture</span></>} subtitle="Générez un numéro de facture conforme à la réglementation : chronologique, sans rupture, personnalisable." badge="Conforme 2026" />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-xl px-5 -mt-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8">
            {/* Résultat en haut */}
            <div className="mb-6 rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#F5F3FF] p-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Votre numéro de facture</p>
              <p className="mt-2 text-[28px] font-extrabold text-[#0F172A] font-mono tracking-wider">{numero}</p>
              <button onClick={() => handleCopy(numero, "main")} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#2563EB] hover:bg-white/60 transition-all">
                {copied === "main" ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copié !</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
              </button>
            </div>

            {/* Format */}
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Format</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {FORMATS.map((f) => (
                  <button key={f.id} onClick={() => setFormat(f.id)} className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${format === f.id ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm" : "border-slate-100 hover:border-slate-200"}`}>
                    <span className={`block text-[13px] font-bold font-mono ${format === f.id ? "text-[#2563EB]" : "text-[#0F172A]"}`}>{f.label}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="grid gap-3 sm:grid-cols-2 mb-5">
              {(format !== "compact") && (
                <div>
                  <label className="text-[12px] font-bold text-slate-500">Préfixe</label>
                  <input className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-bold font-mono text-[#0F172A] outline-none transition-all focus:border-[#2563EB] focus:bg-white" value={prefixe} onChange={(e) => setPrefixe(e.target.value.toUpperCase())} placeholder="F" />
                </div>
              )}
              <div>
                <label className="text-[12px] font-bold text-slate-500">Année</label>
                <input className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-bold font-mono text-[#0F172A] outline-none transition-all focus:border-[#2563EB] focus:bg-white" value={annee} onChange={(e) => setAnnee(e.target.value)} />
              </div>
              {(format === "compact" || format === "full") && (
                <div>
                  <label className="text-[12px] font-bold text-slate-500">Mois</label>
                  <select className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-bold text-[#0F172A] outline-none transition-all focus:border-[#2563EB] focus:bg-white" value={mois} onChange={(e) => setMois(e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={(i + 1).toString().padStart(2, "0")}>{(i + 1).toString().padStart(2, "0")} — {new Date(2026, i).toLocaleString("fr-FR", { month: "long" })}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[12px] font-bold text-slate-500">Compteur départ</label>
                <input type="number" min={1} className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-bold font-mono text-[#0F172A] outline-none transition-all focus:border-[#2563EB] focus:bg-white" value={compteur} onChange={(e) => setCompteur(e.target.value)} />
              </div>
              <div>
                <label className="text-[12px] font-bold text-slate-500">Nb de chiffres</label>
                <select className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-bold text-[#0F172A] outline-none transition-all focus:border-[#2563EB] focus:bg-white" value={digits} onChange={(e) => setDigits(e.target.value)}>
                  <option value="2">2 (01)</option><option value="3">3 (001)</option><option value="4">4 (0001)</option><option value="5">5 (00001)</option>
                </select>
              </div>
            </div>

            {/* Sequence preview */}
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[12px] font-bold text-slate-400 mb-2">Aperçu de la séquence</p>
              <div className="space-y-1">
                {sequence.map((n, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white transition-colors">
                    <span className="text-[14px] font-mono font-semibold text-[#0F172A]">{n}</span>
                    <button onClick={() => handleCopy(n, n)} className="text-slate-300 hover:text-[#2563EB] transition-colors">
                      {copied === n ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Numérotation automatique avec Qonforme</p>
            <p className="mt-1 text-[13px] text-slate-500">Plus jamais de doublon ni de rupture. Qonforme numérote automatiquement chaque facture.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">Automatiser <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>

        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Règles de numérotation des factures</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>La numérotation des factures est encadrée par le <strong>Code de commerce (art. L441-9)</strong> :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Chronologique</strong> — les numéros doivent suivre un ordre croissant</li>
                <li><strong>Sans rupture</strong> — aucun « trou » dans la séquence</li>
                <li><strong>Unique</strong> — chaque numéro ne peut être utilisé qu&apos;une seule fois</li>
              </ul>
              <p>Vous pouvez utiliser n&apos;importe quel format (chiffres, lettres, tirets) tant que ces 3 règles sont respectées.</p>
            </div>
            <div className="mt-12"><h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[{ q: "Puis-je recommencer à 1 chaque année ?", a: "Oui, à condition d'inclure l'année dans le numéro (ex: F-2026-001). Cela garantit l'unicité." }, { q: "Que faire si j'ai un trou dans ma numérotation ?", a: "Un trou peut attirer l'attention du fisc. Documentez la raison (facture annulée) et conservez la trace." }, { q: "Puis-je utiliser des lettres ?", a: "Oui, la loi n'impose aucun format. Lettres, chiffres, tirets sont autorisés tant que la séquence est chronologique." }].map((item) => (
                  <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-[15px] font-semibold text-[#0F172A] list-none">{item.q}<ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><p className="px-5 pb-4 text-[14px] leading-relaxed text-slate-600">{item.a}</p></details>
                ))}
              </div>
            </div>
            <div className="mt-12 rounded-xl bg-slate-50 p-6"><h3 className="text-[14px] font-bold text-slate-500 mb-3">Outils complémentaires</h3><div className="grid gap-2 sm:grid-cols-2">
              {[{ href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" }, { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions" }, { href: "/outils/generateur-conditions-paiement", label: "Conditions de paiement" }, { href: "/outils/verification-siret", label: "Vérificateur SIRET" }].map((l) => (<Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>))}
            </div></div>
          </div>
        </section>
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Générateur numéro de facture conforme", url: "https://qonforme.fr/outils/generateur-numero-facture", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      </main>
      <OutilsCtaBar text="Numérotation auto conforme" cta="Essayer →" />
      <Footer />
    </>
  )
}
