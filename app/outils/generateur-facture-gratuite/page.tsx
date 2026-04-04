"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, ArrowLeft, FileText, ChevronRight, Plus, Trash2, Download, Loader2, RotateCcw, User, Users, List, Eye } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"
import { OutilsHeader } from "@/components/outils/OutilsHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"

interface Ligne {
  id: string; description: string; quantite: number; prixHT: number; tauxTVA: number
}

function newLigne(): Ligne {
  return { id: crypto.randomUUID(), description: "", quantite: 1, prixHT: 0, tauxTVA: 20 }
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
}

const STEPS = [
  { id: 0, label: "Émetteur", icon: User, short: "Vous" },
  { id: 1, label: "Client", icon: Users, short: "Client" },
  { id: 2, label: "Lignes", icon: List, short: "Lignes" },
  { id: 3, label: "Aperçu", icon: Eye, short: "Aperçu" },
]

const inputClass = "w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-[14px] font-medium text-[#0F172A] placeholder-slate-300 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-blue-100"

export default function GenerateurFacturePage() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [emetteur, setEmetteur] = useState({ nom: "", adresse: "", siret: "", email: "" })
  const [client, setClient] = useState({ nom: "", adresse: "", siret: "" })
  const [numero, setNumero] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [echeance, setEcheance] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) })
  const [lignes, setLignes] = useState<Ligne[]>([newLigne()])
  const [mentionTVA, setMentionTVA] = useState("")
  const [notes, setNotes] = useState("")

  const updateLigne = (id: string, field: keyof Ligne, value: string | number) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }
  const removeLigne = (id: string) => { setLignes((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev)) }

  const subtotalHT = lignes.reduce((s, l) => s + l.quantite * l.prixHT, 0)
  const totalTVA = lignes.reduce((s, l) => s + l.quantite * l.prixHT * (l.tauxTVA / 100), 0)
  const totalTTC = subtotalHT + totalTVA
  const canGenerate = emetteur.nom.trim() && client.nom.trim() && lignes.some((l) => l.description.trim() && l.prixHT > 0)

  const handleGenerate = async () => {
    if (!canGenerate) return
    setLoading(true)
    try {
      const res = await fetch("/api/outils/facture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emetteur, client, numero, date, echeance, lignes, mentionTVA, notes }),
      })
      if (!res.ok) throw new Error("Erreur")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `facture-${numero || "brouillon"}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert("Erreur lors de la génération. Veuillez réessayer.") }
    finally { setLoading(false) }
  }

  const handleReset = () => {
    setEmetteur({ nom: "", adresse: "", siret: "", email: "" }); setClient({ nom: "", adresse: "", siret: "" })
    setLignes([newLigne()]); setNumero(""); setMentionTVA(""); setNotes(""); setStep(0)
  }

  return (
    <>
      <OutilsHeader breadcrumb="Générateur facture" />

      <OutilsHero
        icon={<FileText className="h-8 w-8" />}
        iconBg="bg-amber-50 text-amber-600"
        title={<>Générateur de <span className="text-[#2563EB]">facture gratuit</span></>}
        subtitle="Remplissez le formulaire et téléchargez votre facture en PDF. Gratuit, sans inscription, aucune donnée stockée."
        badge="PDF gratuit"
      />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-3xl px-5 -mt-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 overflow-hidden"
          >
            {/* Progress bar */}
            <div className="border-b border-slate-100 px-5 py-4 sm:px-8">
              <div className="flex items-center justify-between">
                {STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setStep(i)}
                    className={`flex flex-col items-center gap-1 transition-all ${step === i ? "scale-105" : "opacity-50"}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all ${
                      step === i ? "bg-[#2563EB] text-white shadow-md shadow-blue-200" : step > i ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    }`}>
                      {step > i ? "✓" : i + 1}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${step === i ? "text-[#2563EB]" : "text-slate-400"}`}>
                      <span className="hidden sm:inline">{s.label}</span>
                      <span className="sm:hidden">{s.short}</span>
                    </span>
                  </button>
                ))}
              </div>
              {/* Progress line */}
              <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED]"
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Steps content */}
            <div className="p-5 sm:p-8 min-h-[320px]">
              <AnimatePresence mode="wait">
                {/* Step 0 — Émetteur */}
                {step === 0 && (
                  <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <h2 className="text-[16px] font-bold text-[#0F172A] mb-4">Vos informations</h2>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[12px] font-bold text-slate-500">Nom / Raison sociale *</label>
                        <input className={inputClass} value={emetteur.nom} onChange={(e) => setEmetteur((p) => ({ ...p, nom: e.target.value }))} placeholder="Ma Société SAS" />
                      </div>
                      <div>
                        <label className="text-[12px] font-bold text-slate-500">Adresse</label>
                        <input className={inputClass} value={emetteur.adresse} onChange={(e) => setEmetteur((p) => ({ ...p, adresse: e.target.value }))} placeholder="12 rue de la Paix, 75001 Paris" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[12px] font-bold text-slate-500">SIRET</label>
                          <input className={inputClass} value={emetteur.siret} onChange={(e) => setEmetteur((p) => ({ ...p, siret: e.target.value }))} placeholder="123 456 789 00012" />
                        </div>
                        <div>
                          <label className="text-[12px] font-bold text-slate-500">Email</label>
                          <input className={inputClass} type="email" value={emetteur.email} onChange={(e) => setEmetteur((p) => ({ ...p, email: e.target.value }))} placeholder="contact@email.fr" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 1 — Client */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <h2 className="text-[16px] font-bold text-[#0F172A] mb-4">Informations client</h2>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[12px] font-bold text-slate-500">Nom / Raison sociale *</label>
                        <input className={inputClass} value={client.nom} onChange={(e) => setClient((p) => ({ ...p, nom: e.target.value }))} placeholder="Client SARL" />
                      </div>
                      <div>
                        <label className="text-[12px] font-bold text-slate-500">Adresse</label>
                        <input className={inputClass} value={client.adresse} onChange={(e) => setClient((p) => ({ ...p, adresse: e.target.value }))} placeholder="5 avenue des Champs-Élysées, 75008 Paris" />
                      </div>
                      <div>
                        <label className="text-[12px] font-bold text-slate-500">SIRET</label>
                        <input className={inputClass} value={client.siret} onChange={(e) => setClient((p) => ({ ...p, siret: e.target.value }))} placeholder="987 654 321 00034" />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="text-[12px] font-bold text-slate-500">N° facture</label>
                          <input className={inputClass} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="F-2026-001" />
                        </div>
                        <div>
                          <label className="text-[12px] font-bold text-slate-500">Émission</label>
                          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[12px] font-bold text-slate-500">Échéance</label>
                          <input className={inputClass} type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2 — Lignes */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <h2 className="text-[16px] font-bold text-[#0F172A] mb-4">Lignes de facturation *</h2>
                    <div className="space-y-3">
                      {lignes.map((l, i) => (
                        <div key={l.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-400">Ligne {i + 1}</span>
                            <button onClick={() => removeLigne(l.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                          <input className={`${inputClass} mb-2`} placeholder="Description" value={l.description} onChange={(e) => updateLigne(l.id, "description", e.target.value)} />
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400">Qté</label>
                              <input className={inputClass} type="number" inputMode="decimal" min={0} value={l.quantite || ""} onChange={(e) => updateLigne(l.id, "quantite", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400">Prix HT</label>
                              <input className={inputClass} type="number" inputMode="decimal" min={0} step={0.01} value={l.prixHT || ""} onChange={(e) => updateLigne(l.id, "prixHT", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400">TVA</label>
                              <select className={inputClass} value={l.tauxTVA} onChange={(e) => updateLigne(l.id, "tauxTVA", parseFloat(e.target.value))}>
                                <option value={20}>20%</option><option value={10}>10%</option><option value={5.5}>5,5%</option><option value={2.1}>2,1%</option><option value={0}>0%</option>
                              </select>
                            </div>
                          </div>
                          {l.prixHT > 0 && (
                            <p className="mt-2 text-right text-[12px] font-semibold text-slate-500">= {fmtEur(l.quantite * l.prixHT)} HT</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setLignes((prev) => [...prev, newLigne()])} className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] transition-colors">
                      <Plus className="h-4 w-4" /> Ajouter une ligne
                    </button>

                    {/* Options */}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[12px] font-bold text-slate-500">Mention TVA</label>
                        <input className={inputClass} value={mentionTVA} onChange={(e) => setMentionTVA(e.target.value)} placeholder="TVA non applicable, art. 293 B" />
                      </div>
                      <div>
                        <label className="text-[12px] font-bold text-slate-500">Notes</label>
                        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Merci pour votre confiance" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3 — Aperçu */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <h2 className="text-[16px] font-bold text-[#0F172A] mb-4">Récapitulatif</h2>

                    <div className="space-y-3">
                      {/* Émetteur & Client */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Émetteur</p>
                          <p className="text-[14px] font-bold text-[#0F172A]">{emetteur.nom || "—"}</p>
                          {emetteur.adresse && <p className="text-[12px] text-slate-500">{emetteur.adresse}</p>}
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Client</p>
                          <p className="text-[14px] font-bold text-[#0F172A]">{client.nom || "—"}</p>
                          {client.adresse && <p className="text-[12px] text-slate-500">{client.adresse}</p>}
                        </div>
                      </div>

                      {/* Lignes */}
                      <div className="rounded-xl border border-slate-100 overflow-hidden">
                        {lignes.filter((l) => l.description).map((l, i) => (
                          <div key={l.id} className={`flex items-center justify-between px-4 py-2.5 text-[13px] ${i % 2 === 0 ? "bg-slate-50/50" : "bg-white"}`}>
                            <span className="text-slate-700">{l.description}</span>
                            <span className="font-semibold">{fmtEur(l.quantite * l.prixHT)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Totaux */}
                      <div className="rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#F5F3FF] p-4">
                        <div className="flex justify-between text-[14px] mb-1">
                          <span className="text-slate-500">Sous-total HT</span>
                          <span className="font-semibold">{fmtEur(subtotalHT)}</span>
                        </div>
                        <div className="flex justify-between text-[14px] mb-1">
                          <span className="text-slate-500">TVA</span>
                          <span className="font-semibold">{fmtEur(totalTVA)}</span>
                        </div>
                        <div className="h-px bg-slate-200/40 my-2" />
                        <div className="flex justify-between text-[18px]">
                          <span className="font-bold text-[#0F172A]">Total TTC</span>
                          <span className="font-extrabold text-[#2563EB]">{fmtEur(totalTTC)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Generate button */}
                    <button
                      onClick={handleGenerate}
                      disabled={!canGenerate || loading}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] py-4 text-[15px] font-bold text-white hover:bg-[#1D4ED8] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                      Télécharger le PDF
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation buttons */}
            <div className="border-t border-slate-100 px-5 py-4 sm:px-8 flex items-center justify-between">
              <button
                onClick={() => step > 0 ? setStep(step - 1) : handleReset()}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                {step > 0 ? <><ArrowLeft className="h-3.5 w-3.5" /> Précédent</> : <><RotateCcw className="h-3.5 w-3.5" /> Réinitialiser</>}
              </button>

              {step < 3 && (
                <button
                  onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#1D4ED8] transition-colors"
                >
                  Suivant <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="mt-8 rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Cette facture n&apos;est pas conforme Factur-X 2026</p>
            <p className="mt-1 text-[13px] text-slate-500">Qonforme génère automatiquement le format Factur-X EN 16931, avec archivage légal 10 ans.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">
              Passer au Factur-X conforme <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>

        {/* SEO */}
        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Créer une facture conforme en France</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>Une facture doit contenir des <strong>mentions obligatoires</strong> :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Identité émetteur</strong> — nom, SIRET, adresse, TVA</li>
                <li><strong>Identité client</strong> — nom, adresse</li>
                <li><strong>Numéro</strong> — unique, chronologique</li>
                <li><strong>Dates</strong> — émission + échéance</li>
                <li><strong>Montants</strong> — HT, TVA, TTC</li>
                <li><strong>Conditions paiement</strong> — pénalités retard + indemnité 40 €</li>
              </ul>
              <h3 className="text-lg font-bold text-[#0F172A] pt-4">2026 : ce qui change</h3>
              <p>La facturation électronique au format <strong>Factur-X</strong> devient obligatoire. Ce générateur produit un PDF basique — pas le format Factur-X.</p>
            </div>
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[
                  { q: "Cette facture est-elle conforme 2026 ?", a: "Non, c'est un PDF basique. Pour la conformité 2026, utilisez le format Factur-X généré par Qonforme." },
                  { q: "Mes données sont-elles sauvegardées ?", a: "Non, aucune donnée n'est stockée. Le PDF est généré puis téléchargé." },
                  { q: "Combien de factures puis-je générer ?", a: "Autant que vous voulez, 100% gratuit." },
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
                  { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis gratuit" },
                  { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
                  { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Générateur de facture gratuit en ligne", url: "https://qonforme.fr/outils/generateur-facture-gratuite", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Cette facture est-elle conforme 2026 ?","acceptedAnswer":{"@type":"Answer","text":"Non, c'est un PDF basique. Pour la conformité 2026, utilisez le format Factur-X."}},{"@type":"Question","name":"Mes données sont-elles sauvegardées ?","acceptedAnswer":{"@type":"Answer","text":"Non, aucune donnée n'est stockée. Le PDF est généré puis téléchargé."}},{"@type":"Question","name":"Combien de factures puis-je générer ?","acceptedAnswer":{"@type":"Answer","text":"Autant que vous voulez, 100% gratuit."}}]}) }} />
      </main>

      <Footer />
    </>
  )
}
