"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Search, ChevronRight, Building2, MapPin, Hash, FileText, Loader2, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import Footer from "@/components/layout/Footer"

const LOGO_URL = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20long%20bleu.webp"

interface SiretResult {
  siren: string
  siret?: string
  name: string
  address: string
  zip_code: string
  city: string
  vat_number?: string
  activity_code?: string
}

export default function VerificationSiretPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SiretResult | null>(null)
  const [error, setError] = useState("")
  const [searched, setSearched] = useState(false)

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

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.")
      } else {
        setResult(data)
      }
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }

  const handleReset = () => {
    setQuery("")
    setResult(null)
    setError("")
    setSearched(false)
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
            <span className="text-slate-600 font-medium">Vérificateur SIRET</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="mx-auto max-w-3xl px-5 pt-8 pb-6 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Search className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl" style={{ fontFamily: "var(--font-bricolage)" }}>
            Vérificateur <span className="text-[#2563EB]">SIREN / SIRET</span>
          </h1>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Vérifiez l&apos;existence et les informations d&apos;une entreprise à partir de son numéro SIREN (9 chiffres) ou SIRET (14 chiffres). Données officielles INSEE.
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
            {/* Input */}
            <div className="mb-5">
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                Numéro SIREN ou SIRET
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={query}
                  onChange={(e) => setQuery(e.target.value.replace(/[^0-9\s]/g, ""))}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex : 443 061 841 ou 443 061 841 00020"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-[#0F172A] placeholder-slate-300 outline-none transition-all focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={loading || !query.trim()}
                  className="shrink-0 rounded-xl bg-[#2563EB] px-5 py-3.5 text-white font-semibold transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-2 text-[12px] text-slate-400">
                SIREN = 9 chiffres (identifie l&apos;entreprise) · SIRET = 14 chiffres (identifie l&apos;établissement)
              </p>
            </div>

            {/* Erreur */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3"
                >
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-[14px] text-red-700">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Résultat */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#ECFDF5] p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-[14px] font-bold text-emerald-700">Entreprise trouvée</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Raison sociale</p>
                        <p className="text-[16px] font-bold text-[#0F172A]">{result.name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Hash className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">SIREN</p>
                        <p className="text-[15px] font-mono font-semibold text-[#0F172A]">{result.siren}</p>
                      </div>
                    </div>

                    {result.siret && (
                      <div className="flex items-start gap-3">
                        <Hash className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">SIRET</p>
                          <p className="text-[15px] font-mono font-semibold text-[#0F172A]">{result.siret}</p>
                        </div>
                      </div>
                    )}

                    {result.vat_number && (
                      <div className="flex items-start gap-3">
                        <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">N° TVA intracommunautaire</p>
                          <p className="text-[15px] font-mono font-semibold text-[#0F172A]">{result.vat_number}</p>
                        </div>
                      </div>
                    )}

                    {(result.address || result.city) && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Adresse</p>
                          <p className="text-[15px] font-semibold text-[#0F172A]">
                            {[result.address, result.zip_code, result.city].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reset */}
            {searched && (
              <button
                onClick={handleReset}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Nouvelle recherche
              </button>
            )}
          </motion.div>

          {/* CTA */}
          <div className="mt-8 rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] to-[#ECFDF5] p-6 text-center">
            <p className="text-[15px] font-bold text-[#0F172A]">Pré-remplissage client automatique</p>
            <p className="mt-1 text-[13px] text-slate-500">
              Avec Qonforme, entrez le SIREN de votre client et toutes ses infos (nom, adresse, TVA) sont remplies automatiquement.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Essayer le pré-remplissage <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Contenu SEO */}
        <section className="border-t border-slate-200 bg-white px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-[#0F172A] mb-6">Comprendre le SIREN et le SIRET</h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
              <p>
                Le <strong>SIREN</strong> (Système d&apos;Identification du Répertoire des Entreprises) est un numéro unique de <strong>9 chiffres</strong> attribué par l&apos;INSEE à chaque entreprise en France. Il identifie l&apos;entité juridique.
              </p>
              <p>
                Le <strong>SIRET</strong> (Système d&apos;Identification du Répertoire des Établissements) est un numéro de <strong>14 chiffres</strong> composé du SIREN + un code NIC (Numéro Interne de Classement) de 5 chiffres. Il identifie chaque établissement (lieu d&apos;activité) de l&apos;entreprise.
              </p>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Pourquoi vérifier un SIREN/SIRET ?</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Avant de facturer</strong> — vérifiez que votre client est bien enregistré et que son entreprise est active</li>
                <li><strong>N° TVA intracommunautaire</strong> — calculé automatiquement à partir du SIREN (format FR + 2 chiffres clé + SIREN)</li>
                <li><strong>Mentions obligatoires</strong> — le SIRET du vendeur est obligatoire sur chaque facture</li>
                <li><strong>Due diligence</strong> — vérifiez l&apos;existence légale d&apos;un partenaire commercial</li>
              </ul>

              <h3 className="text-lg font-bold text-[#0F172A] pt-4">Calcul du n° TVA intracommunautaire</h3>
              <div className="rounded-xl bg-slate-50 p-4 font-mono text-[14px]">
                <p><strong>Formule :</strong> FR + clé + SIREN</p>
                <p className="mt-1"><strong>Clé :</strong> (12 + 3 × (SIREN modulo 97)) modulo 97</p>
                <p className="mt-2 text-slate-500">Exemple : SIREN 443 061 841 → clé = 44 → FR44443061841</p>
              </div>
            </div>

            {/* FAQ */}
            <div className="mt-12">
              <h2 className="text-xl font-bold text-[#0F172A] mb-6">Questions fréquentes</h2>
              <div className="space-y-4">
                {[
                  {
                    q: "Quelle est la différence entre SIREN et SIRET ?",
                    a: "Le SIREN (9 chiffres) identifie l'entreprise. Le SIRET (14 chiffres = SIREN + NIC) identifie un établissement précis. Une entreprise a un seul SIREN mais peut avoir plusieurs SIRET (un par local/agence).",
                  },
                  {
                    q: "Le SIREN est-il obligatoire sur les factures ?",
                    a: "Oui, le SIRET (qui contient le SIREN) est une mention obligatoire sur toute facture selon le Code de commerce. Le n° TVA intracommunautaire est également obligatoire si l'entreprise est assujettie à la TVA.",
                  },
                  {
                    q: "Comment obtenir un numéro SIREN ?",
                    a: "Le SIREN est attribué automatiquement par l'INSEE lors de la création de votre entreprise (via le guichet unique entreprises.gouv.fr). Il est définitif et ne change jamais.",
                  },
                  {
                    q: "D'où proviennent ces données ?",
                    a: "Les données proviennent de l'API Sirene de l'INSEE (Institut National de la Statistique et des Études Économiques), la source officielle du répertoire des entreprises françaises.",
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
                <Link href="/outils/generateur-facture-gratuite" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Générateur de facture gratuit
                </Link>
                <Link href="/outils/verificateur-mentions-facture" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Vérificateur mentions facture
                </Link>
                <Link href="/outils/calculateur-tva" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Calculateur TVA HT/TTC
                </Link>
                <Link href="/outils/verificateur-conformite-facture" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#0F172A] hover:bg-white transition-colors">
                  <span className="text-[#2563EB]">→</span> Vérificateur conformité facture
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
              name: "Vérificateur SIREN SIRET gratuit",
              description: "Vérifiez l'existence et les informations d'une entreprise française à partir de son numéro SIREN ou SIRET. Données officielles INSEE.",
              url: "https://qonforme.fr/outils/verification-siret",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Any",
              offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              author: { "@type": "Organization", name: "Qonforme", url: "https://qonforme.fr" },
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
                { "@type": "Question", name: "Quelle est la différence entre SIREN et SIRET ?", acceptedAnswer: { "@type": "Answer", text: "Le SIREN (9 chiffres) identifie l'entreprise. Le SIRET (14 chiffres) identifie un établissement précis." } },
                { "@type": "Question", name: "Le SIREN est-il obligatoire sur les factures ?", acceptedAnswer: { "@type": "Answer", text: "Oui, le SIRET est une mention obligatoire sur toute facture." } },
                { "@type": "Question", name: "D'où proviennent ces données ?", acceptedAnswer: { "@type": "Answer", text: "Les données proviennent de l'API Sirene de l'INSEE, la source officielle du répertoire des entreprises françaises." } },
              ],
            }),
          }}
        />
      </main>

      <Footer />
    </>
  )
}
