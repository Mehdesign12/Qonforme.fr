"use client"

import { useState, useCallback, useRef } from "react"
import { Search, Building2, MapPin, Hash, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Formula, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, CopyButton, ResetButton } from "@/components/outils/controls"
import { cn } from "@/lib/utils"

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

const FAQ = [
  { q: "Différence SIREN / SIRET ?", a: "SIREN (9 chiffres) = entreprise. SIRET (14 chiffres) = établissement. Une entreprise a 1 SIREN mais peut avoir plusieurs SIRET." },
  { q: "Le SIREN est-il obligatoire sur les factures ?", a: "Oui, le SIRET est une mention obligatoire sur toute facture." },
  { q: "D'où viennent ces données ?", a: "API Sirene de l'INSEE, source officielle du répertoire des entreprises françaises." },
]

export default function VerificationSiretPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SiretResult | null>(null)
  const [error, setError] = useState("")
  const [searched, setSearched] = useState(false)
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

  const rows = result
    ? [
        { icon: Building2, label: "Raison sociale", value: result.name, mono: false },
        { icon: Hash, label: "SIREN", value: result.siren, mono: true },
        ...(result.siret ? [{ icon: Hash, label: "SIRET", value: result.siret, mono: true }] : []),
        ...(result.vat_number ? [{ icon: FileText, label: "N° TVA intracommunautaire", value: result.vat_number, mono: true }] : []),
        ...((result.address || result.city) ? [{ icon: MapPin, label: "Adresse", value: [result.address, result.zip_code, result.city].filter(Boolean).join(", "), mono: false }] : []),
      ]
    : []

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Vos clients remplis à partir de leur SIRET." />}>
      <OutilsHero
        crumb="Vérificateur SIREN / SIRET"
        icon={<Search />}
        badge="Données INSEE"
        title="Vérificateur"
        accent="SIREN et SIRET."
        subtitle="Vérifiez l'existence et les informations d'une entreprise française. Données officielles INSEE."
      />

      <ToolArea>
        <ToolPanel>
          <Field label="Numéro SIREN ou SIRET" htmlFor="siret-q" hint="SIREN = 9 chiffres · SIRET = 14 chiffres · Les espaces sont gérés automatiquement">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <AmountInput
                  id="siret-q"
                  inputMode="numeric"
                  mono
                  suffix=""
                  value={query}
                  onChange={(v) => setQuery(formatSiren(v))}
                  onKeyDown={handleKeyDown}
                  placeholder="443 061 841"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="q-btn q-btn-primary !h-12 shrink-0 !rounded-xl !px-5"
              >
                {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
                <span className="hidden sm:inline">Vérifier</span>
                <span className="sr-only sm:hidden">Vérifier</span>
              </button>
            </div>
          </Field>

          {error && (
            <Callout tone="danger" icon={AlertCircle} className="mt-5">
              {error}
            </Callout>
          )}

          {loading && (
            <div className="mt-5 flex animate-pulse flex-col gap-3 rounded-2xl border border-q-line bg-q-surface-2 p-5" aria-hidden>
              <div className="h-4 w-1/3 rounded bg-q-sunken" />
              <div className="h-6 w-2/3 rounded bg-q-sunken" />
              <div className="h-4 w-1/2 rounded bg-q-sunken" />
              <div className="h-4 w-3/4 rounded bg-q-sunken" />
            </div>
          )}

          <div ref={resultRef}>
            {result && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-q-line bg-q-surface-2" aria-live="polite">
                <div className="flex items-center justify-between gap-3 border-b border-q-line px-4 py-3 sm:px-5">
                  <span className="q-pill q-pill-ok">
                    <CheckCircle2 aria-hidden />
                    Entreprise trouvée
                  </span>
                </div>
                <dl className="q-list">
                  {rows.map((item) => (
                    <div key={item.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-q-text-4" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <dt className="text-[12px] text-q-text-4">{item.label}</dt>
                        <dd className={cn("mt-0.5 break-words text-[15px] font-semibold text-q-ink", item.mono && "font-mono font-medium tracking-[0.02em]")}>{item.value}</dd>
                      </div>
                      <CopyButton text={item.value} label={`Copier ${item.label}`} iconOnly />
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {searched && !loading && (
            <div className="mt-4 flex justify-center">
              <ResetButton onClick={handleReset} label="Nouvelle recherche" />
            </div>
          )}
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Vos clients remplis à partir de leur SIRET"
          text="Dans Qonforme, saisissez le SIRET d'un client : sa raison sociale, son adresse et son numéro de TVA se remplissent depuis le répertoire Sirene."
        />
      </ToolArea>

      <ToolGuide title="Comprendre" accent="SIREN et SIRET.">
        <Prose>
          <p>
            Le <strong>SIREN</strong> (9 chiffres) identifie l&apos;entreprise. Le <strong>SIRET</strong> (14 chiffres = SIREN + NIC) identifie un établissement.
          </p>
          <h3>Pourquoi vérifier ?</h3>
          <ul>
            <li><strong>Avant de facturer</strong> : vérifiez que votre client existe</li>
            <li><strong>N° TVA</strong> : calculé à partir du SIREN</li>
            <li><strong>Mentions obligatoires</strong> : le SIRET est requis sur chaque facture</li>
          </ul>
          <h3>Calcul du n° TVA</h3>
          <Formula>
            <p>Clé : (12 + 3 × (SIREN mod 97)) mod 97</p>
            <p className="text-q-text-4">Ex : SIREN 443 061 841 → FR44443061841</p>
          </Formula>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/verificateur-conformite-facture", label: "Vérificateur conformité facture" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Vérificateur SIREN SIRET gratuit", "/outils/verification-siret")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
