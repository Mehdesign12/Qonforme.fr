"use client"

import { useState, useCallback, useRef } from "react"
import { Search, Building2, MapPin, Hash, FileText, AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Formula, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, CopyButton, ResetButton } from "@/components/outils/controls"
import { cn } from "@/lib/utils"
import { isValidSiren } from "@/lib/utils/invoice"

interface SiretResult {
  siren: string
  siret?: string
  name: string
  address: string
  zip_code: string
  city: string
  vat_number?: string
  /** Unité légale fermée (cessée) au répertoire Sirene. */
  closed?: boolean
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
  { q: "Le SIREN est-il obligatoire sur les factures ?", a: "Oui : toute entreprise immatriculée indique son numéro SIREN sur ses factures (art. R123-237 du Code de commerce). Le SIRET, qui désigne un établissement, peut le compléter." },
  { q: "D'où viennent ces données ?", a: "Du répertoire Sirene de l'INSEE, le répertoire officiel des entreprises françaises : interrogé par l'API Sirene de l'INSEE ou, si elle ne répond pas, par l'API Recherche d'entreprises de l'État, qui lit le même répertoire." },
  { q: "Le numéro de TVA affiché est-il fiable ?", a: "Il est calculé à partir du SIREN avec la formule officielle de la clé. Il ne dit pas si l'entreprise est réellement immatriculée à la TVA : vérifiez-le sur le service VIES de la Commission européenne avant de l'utiliser sur une facture." },
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
    setError("")
    setResult(null)
    setSearched(true)
    // Contrôles locaux avant tout appel : longueur, puis clé de Luhn du SIREN
    if (!/^\d+$/.test(cleaned) || (cleaned.length !== 9 && cleaned.length !== 14)) {
      setError("Le numéro doit contenir 9 chiffres (SIREN) ou 14 chiffres (SIRET).")
      return
    }
    if (!isValidSiren(cleaned.slice(0, 9))) {
      setError("Ce numéro n'existe pas : sa clé de contrôle ne correspond pas. Vérifiez chaque chiffre.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/outils/siret?q=${encodeURIComponent(cleaned)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(
          data?.error ||
            (res.status === 503
              ? "Le répertoire Sirene ne répond pas pour le moment. Réessayez dans un instant."
              : "Une erreur est survenue. Réessayez dans un instant."),
        )
      } else {
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
        // Calculé depuis le SIREN : rien ne garantit l'immatriculation à la TVA, et sans objet pour une entreprise fermée
        ...(result.vat_number && !result.closed ? [{ icon: FileText, label: "N° de TVA calculé depuis le SIREN (à confirmer sur VIES)", value: result.vat_number, mono: true }] : []),
        ...((result.address || result.city)
          ? [{ icon: MapPin, label: "Adresse", value: [result.address, [result.zip_code, result.city].filter(Boolean).join(" ")].filter(Boolean).join(", "), mono: false }]
          : []),
      ]
    : []

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Vos clients remplis à partir de leur SIRET." />}>
      <OutilsHero
        crumb="Vérificateur SIREN / SIRET"
        icon={<Search />}
        badge="Répertoire Sirene"
        title="Vérificateur"
        accent="SIREN et SIRET."
        subtitle="Vérifiez l'existence et les informations d'une entreprise française, d'après le répertoire Sirene de l'INSEE."
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
                <div className="flex flex-col gap-3 border-b border-q-line px-4 py-3 sm:px-5">
                  {result.closed ? (
                    <>
                      <span className="q-pill q-pill-warn self-start">
                        <AlertTriangle aria-hidden />
                        Entreprise fermée
                      </span>
                      <p className="text-[13px] leading-[1.5] text-q-text-3">
                        Le répertoire Sirene indique que cette entreprise a cessé son activité. Ne lui adressez pas de facture sans vérifier auprès de votre client.
                      </p>
                    </>
                  ) : (
                    <span className="q-pill q-pill-ok self-start">
                      <CheckCircle2 aria-hidden />
                      Entreprise active
                    </span>
                  )}
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
            <li><strong>N° TVA</strong> : calculé à partir du SIREN, à confirmer sur le service VIES de la Commission européenne</li>
            <li><strong>Mentions obligatoires</strong> : le SIREN est requis sur chaque facture (art. R123-237 du Code de commerce)</li>
          </ul>
          <h3>Calcul du n° TVA</h3>
          <Formula>
            <p>Clé : (12 + 3 × (SIREN mod 97)) mod 97</p>
            <p className="text-q-text-4">Ex : SIREN 443 061 841 → 443061841 mod 97 = 82 ; (12 + 3 × 82) mod 97 = 64 → FR64443061841</p>
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
