"use client"

import { useState, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Search, ChevronRight, Building2, MapPin, Hash, FileText, AlertCircle, CheckCircle2, RotateCcw, Copy, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"

interface SiretResult {
  siren: string
  siret?: string
  name: string
  address: string
  zip_code: string
  city: string
  vat_number?: string
}

function formatSiren(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 14)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  if (digits.length <= 14) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  return digits
}

export default function VerificationSiretPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SiretResult | null>(null)
  const [error, setError] = useState("")
  const [searched, setSearched] = useState(false)
  const [copiedField, setCopiedField] = useState("")
  const resultRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(async () => {
    const cleaned = query.replace(/\s/g, "")
    if (!cleaned) return
    setLoading(true)
    setError("")
    setResult(null)
    setSearched(true)
    try {
      const res = await fetch(`/api/outils/siret?q=${encodeURIComponent(cleaned)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Une erreur est survenue.") }
      else {
        setResult(data)
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100)
      }
    } catch { setError("Erreur de connexion. Veuillez réessayer.") }
    finally { setLoading(false) }
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch() }

  const handleReset = () => { setQuery(""); setResult(null); setError(""); setSearched(false) }

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedField(label)
    setTimeout(() => setCopiedField(""), 2000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(formatSiren(e.target.value))
  }

  return (
    <>
      <PublicHeader />

      <OutilsHero
        icon={<Search className="h-8 w-8" />}
        iconBg="bg-violet-50 text-violet-600"
        title={<>Vérificateur <span className="text-[#2563EB]">SIREN / SIRET</span></>}
        subtitle="Vérifiez l'existence et les informations d'une entreprise française. Données officielles INSEE."
        badge="Données INSEE"
      />

      <main className="bg-[#F8FAFC] pb-20 sm:pb-16">
        <section className="mx-auto max-w-xl px-5 -mt-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-8"
          >
            {/* Input */}
            <div className="mb-5">
              <label className="mb-2 block text-[13px] font-bold text-slate-700">Numéro SIREN ou SIRET</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text" inputMode="numeric" value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="443 061 841"
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-xl font-extrabold text-[#0F172A] placeholder-slate-200 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:shadow-lg focus:shadow-blue-100/40 tracking-wider"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={loading || !query.trim()}
                  className="shrink-0 flex h-auto items-center justify-center rounded-2xl bg-[#2563EB] px-5 text-white font-semibold transition-all hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Search className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">SIREN = 9 chiffres · SIRET = 14 chiffres · Les espaces sont gérés automatiquement</p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-[14px] text-red-700">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Skeleton loading */}
            {loading && (
              <div className="rounded-xl bg-slate-50 p-5 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-2/3" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
              </div>
            )}

            {/* Result */}
            <div ref={resultRef}>
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-2xl bg-gradient-to-br from-[#EFF6FF] via-[#F5F3FF] to-[#ECFDF5] p-5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <p className="text-[14px] font-bold text-emerald-700">Entreprise trouvée</p>
                    </div>

                    <div className="space-y-3">
                      {[
                        { icon: Building2, label: "Raison sociale", value: result.name, mono: false },
                        { icon: Hash, label: "SIREN", value: result.siren, mono: true },
                        ...(result.siret ? [{ icon: Hash, label: "SIRET", value: result.siret, mono: true }] : []),
                        ...(result.vat_number ? [{ icon: FileText, label: "N° TVA intracommunautaire", value: result.vat_number, mono: true }] : []),
                        ...((result.address || result.city) ? [{ icon: MapPin, label: "Adresse", value: [result.address, result.zip_code, result.city].filter(Boolean).join(", "), mono: false }] : []),
                      ].map((item) => (
                        <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl bg-white/60 px-4 py-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <item.icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                              <p className={`mt-0.5 text-[15px] font-semibold text-[#0F172A] break-all ${item.mono ? "font-mono tracking-wider" : ""}`}>{item.value}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCopy(item.label, item.value)}
                            className="shrink-0 mt-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:text-[#2563EB] hover:bg-white transition-all"
                            title="Copier"
                          >
                            {copiedField === item.label ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {searched && !loading && (
              <button onClick={handleReset} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                <RotateCcw className="h-3.5 w-3.5" /> Nouvelle recherche
              </button>
            )}
          </motion.div>

          {/* CTA desktop */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="mt-8 hidden sm:block rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Pré-remplissage client automatique</p>
            <p className="mt-1 text-[13px] text-slate-500">Entrez le SIREN de votre client → nom, adresse, TVA remplis automatiquement.</p>
            <Link href="/signup" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors">
              Essayer le pré-remplissage <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>

        {/* SEO */}
        <section className="mt-16 border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Comprendre SIREN et SIRET</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>Le <strong>SIREN</strong> (9 chiffres) identifie l&apos;entreprise. Le <strong>SIRET</strong> (14 chiffres = SIREN + NIC) identifie un établissement.</p>
              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Pourquoi vérifier ?</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Avant de facturer</strong> — vérifiez que votre client existe</li>
                <li><strong>N° TVA</strong> — calculé à partir du SIREN</li>
                <li><strong>Mentions obligatoires</strong> — le SIRET est requis sur chaque facture</li>
              </ul>
              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Calcul n° TVA</h3>
              <div className="rounded-xl bg-slate-50 p-4 font-mono text-[14px]">
                <p><strong>Clé :</strong> (12 + 3 × (SIREN mod 97)) mod 97</p>
                <p className="mt-1 text-slate-500">Ex : SIREN 443 061 841 → FR44443061841</p>
              </div>
            </div>
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-3">
                {[
                  { q: "Différence SIREN / SIRET ?", a: "SIREN (9 chiffres) = entreprise. SIRET (14 chiffres) = établissement. Une entreprise a 1 SIREN mais peut avoir plusieurs SIRET." },
                  { q: "Le SIREN est-il obligatoire sur les factures ?", a: "Oui, le SIRET est une mention obligatoire sur toute facture." },
                  { q: "D'où viennent ces données ?", a: "API Sirene de l'INSEE, source officielle du répertoire des entreprises françaises." },
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
                  { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
                  { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
                  { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
                  { href: "/outils/verificateur-conformite-facture", label: "Vérificateur conformité facture" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors"><span className="text-[#2563EB]">→</span> {l.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "Vérificateur SIREN SIRET gratuit", url: "https://qonforme.fr/outils/verification-siret", applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" }, author: { "@type": "Organization", name: "Qonforme" } }) }} />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Différence SIREN / SIRET ?","acceptedAnswer":{"@type":"Answer","text":"SIREN (9 chiffres) = entreprise. SIRET (14 chiffres) = établissement."}},{"@type":"Question","name":"Le SIREN est-il obligatoire sur les factures ?","acceptedAnswer":{"@type":"Answer","text":"Oui, le SIRET est une mention obligatoire sur toute facture."}},{"@type":"Question","name":"D'où viennent ces données ?","acceptedAnswer":{"@type":"Answer","text":"API Sirene de l'INSEE, source officielle du répertoire des entreprises françaises."}}]}) }} />
      </main>

      <OutilsCtaBar text="Pré-remplissage client SIREN" cta="Essayer →" />
      <Footer />
    </>
  )
}
