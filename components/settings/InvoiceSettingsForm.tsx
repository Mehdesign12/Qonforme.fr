'use client'

/**
 * Paramètres › Modèles de documents (planche « Paramètres — Modèles de
 * documents ») : apparence (logo, couleur d'accent), numérotation, mentions et
 * conditions, avec l'aperçu d'une facture à droite.
 *
 * Seuls les réglages qui existent sont proposés : pas de lien de paiement,
 * de QR code, de mention de plateforme agréée ni de signature en ligne
 * (non livrés, DECISIONS § 10).
 *
 * Enregistrement : PATCH /api/company réécrit toutes les colonnes de
 * l'entreprise (un champ absent y devient vide). On renvoie donc la fiche
 * complète, chargée au départ, avec les réglages modifiés.
 *
 * Même composant pour la démo (`mode="demo"`) : rien n'est lu ni enregistré.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Info, Loader2, Palette } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { DirtyHint, Field, MobileSaveBar, SaveButton, SettingsCard } from "@/components/settings/ui"
import { LogoInline, useCompanyLogo } from "@/components/settings/LogoField"
import { DocumentPreview, type PreviewCompany } from "@/components/settings/DocumentPreview"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface InvoiceForm {
  legal_notice: string
  accent_color: string
  invoice_prefix: string
  payment_terms: string
}

export interface InvoiceSettingsDemo {
  company: PreviewCompany
  settings: InvoiceForm
  logo_url: string | null
  /** Numéros déjà attribués, pour calculer les prochains. */
  invoiceNumbers: string[]
  quoteNumbers: string[]
}

/* Couleurs prédéfinies (toute autre couleur reste possible : pastille « personnalisée ») */
const PRESET_COLORS = [
  { label: "Bleu Qonforme",   value: "#2563EB" },
  { label: "Encre",           value: "#0A1122" },
  { label: "Bleu marine",     value: "#1E3A5F" },
  { label: "Vert forêt",      value: "#15803D" },
  { label: "Sarcelle",        value: "#0E7490" },
  { label: "Gris anthracite", value: "#374151" },
  { label: "Rouge grenat",    value: "#B91C1C" },
]

/* Mentions légales suggérées selon le statut */
const LEGAL_TEMPLATES = [
  {
    label: "Micro-entrepreneur",
    text: "Dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM).\nTVA non applicable, art. 293 B du CGI.",
  },
  {
    label: "SARL / SAS",
    text: "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera exigible (art. L. 441-10 C. com.).\nIndemnité forfaitaire pour frais de recouvrement : 40 € (art. D. 441-5 C. com.).",
  },
  {
    label: "Artisan du bâtiment",
    text: "Artisan inscrit au répertoire des métiers.\nAssurance décennale : [Nom assureur], police n° [XXXXXXXX], valable pour les travaux réalisés en France.",
  },
]

const EMPTY_COMPANY: PreviewCompany = {
  name: "", address: "", zip_code: "", city: "", siren: "", siret: "", vat_number: "", iban: "",
}

const FORM_ID = "models-form"

const demoToast = () =>
  toast("Créez un compte pour enregistrer vos modèles", {
    action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
  })

/** Prochain numéro d'une série « PRÉFIXE-AAAA-NNN » (même calcul que lib/utils/document-numbering.ts). */
function nextNumber(existing: string[], seriesPrefix: string): string {
  let max = 0
  for (const n of existing) {
    if (!n?.startsWith(seriesPrefix)) continue
    const seq = parseInt(n.split("-").pop() ?? "", 10)
    if (!isNaN(seq) && seq > max) max = seq
  }
  return `${seriesPrefix}${String(max + 1).padStart(3, "0")}`
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

export function InvoiceSettingsForm({ mode = "app", demo: demoData }: { mode?: ShellMode; demo?: InvoiceSettingsDemo }) {
  const demo = mode === "demo"
  const [loading, setLoading]   = useState(!demo)
  const [saving, setSaving]     = useState(false)
  const [hasCompany, setHasCompany] = useState(demo)
  const [preview, setPreview]   = useState<PreviewCompany>(demoData?.company ?? EMPTY_COMPANY)
  const [loadedLogo, setLoadedLogo] = useState<string | null>(demoData?.logo_url ?? null)
  const [invoiceNumbers, setInvoiceNumbers] = useState<string[]>(demoData?.invoiceNumbers ?? [])
  const [quoteNumbers, setQuoteNumbers]     = useState<string[]>(demoData?.quoteNumbers ?? [])
  // Fiche complète de l'entreprise, renvoyée telle quelle à l'enregistrement (voir l'en-tête)
  const companyRef = useRef<Record<string, unknown> | null>(null)

  const logo = useCompanyLogo({ mode, initialUrl: loadedLogo })

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { isDirty },
  } = useForm<InvoiceForm>({
    defaultValues: demoData?.settings ?? { legal_notice: "", accent_color: "#2563EB", invoice_prefix: "F", payment_terms: "" },
  })

  const accentColor = watch("accent_color")
  const prefix      = (watch("invoice_prefix") || "F").trim() || "F"
  const legalNotice = watch("legal_notice")
  const year        = new Date().getFullYear()

  /* Chargement des données existantes */
  useEffect(() => {
    if (demo) return
    fetch("/api/company")
      .then(r => r.json())
      .then(json => {
        const c = json.company
        if (c) {
          companyRef.current = c
          setHasCompany(true)
          reset({
            legal_notice:   c.legal_notice   ?? "",
            accent_color:   c.accent_color   ?? "#2563EB",
            invoice_prefix: c.invoice_prefix ?? "F",
            payment_terms:  c.payment_terms  ?? "",
          })
          setLoadedLogo(c.logo_url ?? null)
          setPreview({
            name: c.name ?? "", address: c.address ?? "", zip_code: c.zip_code ?? "", city: c.city ?? "",
            siren: c.siren ?? "", siret: c.siret ?? "", vat_number: c.vat_number ?? "", iban: c.iban ?? "",
          })
        }
      })
      .catch(() => toast.error("Impossible de charger vos réglages"))
      .finally(() => setLoading(false))

    // Numéros déjà attribués cette année, pour annoncer les prochains (lecture seule)
    const supabase = createClient()
    supabase.from("invoices").select("invoice_number").like("invoice_number", `%-${year}-%`)
      .then(({ data }) => setInvoiceNumbers((data ?? []).flatMap(r => (r.invoice_number ? [r.invoice_number as string] : []))))
    supabase.from("quotes").select("quote_number").like("quote_number", `D-${year}-%`)
      .then(({ data }) => setQuoteNumbers((data ?? []).map(r => r.quote_number as string)))
  }, [demo, reset, year])

  const nextInvoice = useMemo(() => nextNumber(invoiceNumbers, `${prefix}-${year}-`), [invoiceNumbers, prefix, year])
  const nextQuote   = useMemo(() => nextNumber(quoteNumbers, `D-${year}-`), [quoteNumbers, year])

  /* Enregistrement : couleur, mentions, préfixe, conditions */
  const onSubmit = async (data: InvoiceForm) => {
    if (demo) { demoToast(); return }
    if (!companyRef.current) { toast.error("Renseignez d'abord votre entreprise"); return }
    setSaving(true)
    try {
      // Le logo a son propre endpoint : on ne renvoie pas une URL peut-être périmée
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { logo_url, ...company } = companyRef.current
      const payload = {
        ...company,
        legal_notice:   data.legal_notice,
        accent_color:   data.accent_color,
        invoice_prefix: data.invoice_prefix.trim().toUpperCase() || "F",
        payment_terms:  data.payment_terms,
      }
      const res = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || "Erreur lors de l'enregistrement"); return }
      if (json.company) companyRef.current = json.company
      reset({ ...data, invoice_prefix: payload.invoice_prefix })
      toast.success("Modèles enregistrés")
    } catch { toast.error("Erreur réseau") }
    finally { setSaving(false) }
  }

  const isPreset = PRESET_COLORS.some(c => c.value.toLowerCase() === accentColor?.toLowerCase())

  return (
    <>
      <PageHeader
        title="Modèles de documents"
        subtitle="Devis, factures, avoirs : un même style partout"
        backHref={settingsHref("/settings", mode)}
        backLabel="Paramètres"
        actions={
          <>
            {isDirty && <DirtyHint className="hidden lg:inline-flex" />}
            <SaveButton form={FORM_ID} saving={saving} disabled={loading || !isDirty || !hasCompany} />
          </>
        }
      />

      {loading ? (
        <div className="q-card flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-label="Chargement" />
        </div>
      ) : (
        <form
          id={FORM_ID}
          onSubmit={handleSubmit(onSubmit)}
          className="grid items-start gap-5 min-[1360px]:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]"
        >
          {logo.input}
          <div className="flex min-w-0 flex-col gap-4">
            {!hasCompany && (
              <div className="q-banner q-banner-warn" role="status">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  Renseignez d&apos;abord votre entreprise : vos modèles s&apos;enregistrent avec elle.{" "}
                  <Link href={settingsHref("/settings/company", mode)} className="font-semibold underline">Compléter mon entreprise</Link>
                </p>
              </div>
            )}

            {/* ---- Apparence ---- */}
            <SettingsCard id="apparence" title="Apparence">
              <LogoInline logo={logo} disabled={!hasCompany} />

              <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-3.5">
                <span className="q-label" id="accent-label">Couleur d&apos;accent</span>
                <div role="radiogroup" aria-labelledby="accent-label" className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => {
                    const on = accentColor?.toLowerCase() === c.value.toLowerCase()
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={c.label}
                        title={c.label}
                        onClick={() => setValue("accent_color", c.value, { shouldDirty: true })}
                        className={cn(
                          "size-10 rounded-[11px] bg-[var(--q-surface)] p-[3px] transition-[border-color]",
                          on ? "border-2 border-[var(--q-ink)]" : "border border-[var(--q-field)] hover:border-[var(--q-text-4)]",
                        )}
                      >
                        <span className="block size-full rounded-[7px]" style={{ backgroundColor: c.value }} />
                      </button>
                    )
                  })}
                  {/* Couleur personnalisée */}
                  <label
                    title="Couleur personnalisée"
                    className={cn(
                      "relative grid size-10 cursor-pointer place-items-center overflow-hidden rounded-[11px] bg-[var(--q-surface)] p-[3px]",
                      !isPreset ? "border-2 border-[var(--q-ink)]" : "border border-dashed border-[var(--q-field)] hover:border-[var(--q-text-4)]",
                    )}
                  >
                    <span className="sr-only">Couleur personnalisée</span>
                    {isPreset
                      ? <Palette className="size-[18px] text-[var(--q-text-3)]" strokeWidth={1.75} aria-hidden />
                      : <span className="block size-full rounded-[7px]" style={{ backgroundColor: accentColor }} />}
                    <input
                      type="color"
                      {...register("accent_color")}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <p className="q-field-hint">
                  Bande, numéro et total de vos PDF. Couleur choisie : <span className="font-mono">{accentColor}</span>
                </p>
              </div>
            </SettingsCard>

            {/* ---- Numérotation ---- */}
            <SettingsCard id="numerotation" title="Numérotation">
              <Field
                label="Préfixe des factures"
                htmlFor="invoice_prefix"
                hint={<>Prochain numéro : <span className="font-mono text-[var(--q-text-3)]">{nextInvoice}</span>, attribué à l&apos;envoi de la prochaine facture</>}
              >
                <input
                  id="invoice_prefix"
                  className="q-input font-mono uppercase"
                  placeholder="F"
                  maxLength={5}
                  {...register("invoice_prefix")}
                />
              </Field>
              <div className="flex flex-col gap-1">
                <span className="q-label">Devis</span>
                <p className="text-[13px] text-[var(--q-text-4)]">
                  Préfixe fixe. Prochain numéro : <span className="font-mono text-[var(--q-text-3)]">{nextQuote}</span>
                </p>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
                Chaque série est continue et sans trou, comme l&apos;exige la réglementation. Une facture reçoit
                son numéro au moment où vous l&apos;envoyez, jamais en brouillon : supprimer un brouillon ne laisse
                pas de trou. Le numéro d&apos;une facture émise ne change jamais : un nouveau préfixe ouvre une
                nouvelle série à partir de la prochaine facture.
              </p>
            </SettingsCard>

            {/* ---- Mentions et conditions ---- */}
            <SettingsCard id="mentions" title="Mentions et conditions">
              <Field
                label="Mentions légales"
                htmlFor="legal_notice"
                hint="En bas de chaque facture (4 lignes au plus). Obligatoires selon votre statut."
              >
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {LEGAL_TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setValue("legal_notice", t.text, { shouldDirty: true })}
                      className="q-btn q-btn-secondary !h-8 !rounded-full !px-3 !text-[13px] !font-medium"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  id="legal_notice"
                  rows={4}
                  {...register("legal_notice")}
                  placeholder={"Ex : TVA non applicable, art. 293 B du CGI.\nEn cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera exigible."}
                  className="q-input"
                />
              </Field>

              <div className="q-inset flex flex-col gap-1.5 p-3.5">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--q-ink)]">
                  <Info className="size-4 shrink-0 text-[var(--q-accent-strong)]" aria-hidden />
                  Mentions obligatoires sur une facture entre professionnels
                </p>
                <ul className="flex flex-col gap-1 pl-[22px] text-[13px] text-[var(--q-text-3)]">
                  <li className="list-disc">Pénalités de retard : taux et date d&apos;exigibilité</li>
                  <li className="list-disc">Indemnité forfaitaire de recouvrement : 40 €</li>
                  <li className="list-disc">Conditions d&apos;escompte (si applicable)</li>
                  <li className="list-disc">Micro-entrepreneur : mention de l&apos;art. 293 B du CGI</li>
                </ul>
              </div>

              <Field
                label="Conditions de paiement"
                htmlFor="payment_terms"
                hint="Enregistrées avec votre entreprise. Elles ne sont pas encore reprises seules sur les factures : précisez-les dans les notes de la facture ou dans les mentions ci-dessus."
              >
                <textarea
                  id="payment_terms"
                  rows={3}
                  {...register("payment_terms")}
                  placeholder="Paiement par virement bancaire sous 30 jours."
                  className="q-input"
                />
              </Field>
            </SettingsCard>
          </div>

          {/* ---- Aperçu ---- */}
          <aside aria-label="Aperçu" className="q-paper-bed flex flex-col gap-3 !rounded-[18px] !p-5 min-[1360px]:sticky min-[1360px]:top-[84px]">
            <span className="text-xs font-semibold text-[var(--q-text-3)]">Aperçu d&apos;une facture (lignes d&apos;exemple)</span>
            <DocumentPreview
              accent={accentColor}
              logo={logo.preview}
              company={preview}
              number={nextInvoice}
              legalNotice={legalNotice ?? ""}
            />
          </aside>

          <div className="min-[1360px]:col-span-2">
            <MobileSaveBar show={isDirty} form={FORM_ID} saving={saving} />
          </div>
        </form>
      )}
    </>
  )
}
