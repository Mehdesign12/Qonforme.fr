"use client"

import { useState, useMemo } from "react"
import { FileCheck, CheckCircle2 } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Gauge, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { Checklist, ResetButton } from "@/components/outils/controls"
import { cn } from "@/lib/utils"

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

const FAQ = [
  { q: "Quelle amende pour une mention manquante ?", a: "15 € par mention manquante et par facture, plafonné à 25 % du montant (art. 1737 CGI)." },
  { q: "L'indemnité de recouvrement de 40 € est-elle obligatoire ?", a: "Oui, la mention de cette indemnité doit figurer sur toute facture B2B depuis 2013." },
  { q: "Un auto-entrepreneur a-t-il les mêmes obligations ?", a: "Oui, plus la mention spécifique « TVA non applicable, art. 293 B du CGI » s'il est en franchise." },
]

export default function VerificateurMentionsPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }))
  const reset = () => setChecked({})

  const obligatoires = MENTIONS.filter((m) => m.obligatoire)
  const checkedObligatoires = obligatoires.filter((m) => checked[m.id])
  const score = obligatoires.length > 0 ? Math.round((checkedObligatoires.length / obligatoires.length) * 100) : 0

  const categories = useMemo(() => {
    const cats = new Map<string, (typeof MENTIONS[number] & { tag: string })[]>()
    for (const m of MENTIONS) {
      if (!cats.has(m.category)) cats.set(m.category, [])
      cats.get(m.category)!.push({ ...m, tag: m.obligatoire ? "Obligatoire" : "Optionnel" })
    }
    return Array.from(cats.entries())
  }, [])

  const tone = score === 100 ? "ok" : score >= 70 ? "warn" : "danger"
  const scoreText = { ok: "text-q-ok", warn: "text-q-warn", danger: "text-q-danger" }[tone]

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Vos mentions légales sur chaque facture, sans les ressaisir." />}>
      <OutilsHero
        crumb="Mentions obligatoires"
        icon={<FileCheck />}
        badge="Réglementation 2026"
        title="Vérificateur des mentions"
        accent="obligatoires."
        subtitle="Cochez chaque mention présente sur votre facture. Obtenez votre score instantanément."
      />

      <ToolArea width="md">
        {/* Score, collé en haut sur grand écran pendant que l'on coche */}
        <div className="q-card z-10 p-5 sm:p-6 lg:sticky lg:top-[96px]" aria-live="polite">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] text-q-text-4">Score des mentions obligatoires</p>
              <p className={cn("mt-1 font-display text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums", scoreText)}>{score}&nbsp;%</p>
            </div>
            <p className="pb-1 text-right text-[13px] text-q-text-3">
              <span className="font-semibold tabular-nums text-q-ink">{checkedObligatoires.length} / {obligatoires.length}</span> mentions obligatoires
            </p>
          </div>
          <div className="mt-4">
            <Gauge label="Progression" value="" percent={score} tone={tone} />
          </div>
          {score === 100 && (
            <p className="q-field-ok mt-3 !text-[14px] font-medium">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Votre facture contient toutes les mentions obligatoires.
            </p>
          )}
        </div>

        <Checklist groups={categories} checked={checked} onToggle={toggle} footer={<ResetButton onClick={reset} />} />

        <ToolCta
          className="hidden sm:flex"
          title="Des factures complètes sans tout ressaisir"
          text="Dans Qonforme, l'identité de votre entreprise, le client, le numéro, les dates, la TVA et les totaux se remplissent seuls ; vos mentions légales (pénalités, indemnité, escompte) s'enregistrent une fois dans vos réglages."
        />
      </ToolArea>

      <ToolGuide title="Mentions obligatoires" accent="sur une facture en 2026.">
        <Prose>
          <p>
            La réglementation française impose des <strong>mentions obligatoires</strong> sur chaque facture. L&apos;absence d&apos;une mention peut entraîner une amende de <strong>15 € par mention manquante</strong> (art. 1737 du CGI), plafonnée à 25 % du montant de la facture.
          </p>
          <p>
            Avec la réforme, les factures entre entreprises passent en <strong>facture électronique</strong> (Factur-X, UBL ou CII), par une plateforme agréée : réception obligatoire pour toutes les entreprises depuis le 1er septembre 2026, émission obligatoire pour les TPE et PME à partir du 1er septembre 2027.
          </p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/verificateur-conformite-facture", label: "Vérificateur conformité facture" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/calculateur-penalites-retard", label: "Calculateur pénalités retard" },
            { href: "/outils/generateur-conditions-paiement", label: "Générateur conditions paiement" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Vérificateur mentions obligatoires facture", "/outils/verificateur-mentions-facture")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
