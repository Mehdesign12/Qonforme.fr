"use client"

import { useState, useMemo } from "react"
import { Shield, CheckCircle2, XCircle, AlertTriangle, CircleDashed } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { Checklist, ResetButton } from "@/components/outils/controls"
import { cn } from "@/lib/utils"

const CRITERES = [
  { id: "format_pdf", label: "La facture est au format PDF", weight: 1, category: "Format" },
  { id: "format_facturx", label: "La facture est au format Factur-X (PDF + XML)", weight: 3, category: "Format", help: "Émission électronique obligatoire pour les TPE et PME au 1er septembre 2027" },
  { id: "format_en16931", label: "Le XML est conforme EN 16931", weight: 3, category: "Format", help: "Norme européenne de facturation électronique" },
  { id: "emetteur_complet", label: "Identité émetteur complète (nom, SIRET, adresse, TVA)", weight: 2, category: "Émetteur" },
  { id: "client_complet", label: "Identité client complète (nom, adresse)", weight: 2, category: "Client" },
  { id: "client_siret", label: "SIRET ou TVA du client (B2B)", weight: 1, category: "Client" },
  { id: "numero_unique", label: "Numéro de facture unique et chronologique", weight: 2, category: "Identification" },
  { id: "dates", label: "Date d'émission et date d'échéance présentes", weight: 2, category: "Identification" },
  { id: "lignes_detail", label: "Lignes détaillées (description, qté, prix HT, TVA)", weight: 2, category: "Contenu" },
  { id: "totaux", label: "Totaux HT, TVA et TTC calculés correctement", weight: 2, category: "Contenu" },
  { id: "tva_par_taux", label: "Ventilation TVA par taux applicable", weight: 1, category: "Contenu" },
  { id: "conditions_paiement", label: "Conditions de paiement (délai, mode)", weight: 1, category: "Conditions" },
  { id: "penalites_retard", label: "Mention des pénalités de retard", weight: 1, category: "Conditions" },
  { id: "indemnite_40", label: "Mention indemnité forfaitaire 40 €", weight: 1, category: "Conditions" },
  { id: "escompte", label: "Conditions d'escompte ou mention d'absence", weight: 1, category: "Conditions" },
  { id: "archivage", label: "Archivage légal garanti 10 ans", weight: 2, category: "Archivage", help: "Obligation de conservation fiscale" },
  { id: "integrite", label: "Intégrité et authenticité garanties", weight: 2, category: "Archivage", help: "Signature ou piste d'audit fiable" },
]

const FAQ = [
  { q: "Ma facture PDF classique est-elle conforme en 2026 ?", a: "Pour une TPE ou une PME, oui jusqu'au 1er septembre 2027 : l'émission de factures électroniques entre entreprises (Factur-X, UBL ou CII, par une plateforme agréée) devient alors obligatoire. La réception de factures électroniques est obligatoire pour toutes les entreprises depuis le 1er septembre 2026." },
  { q: "Qu'est-ce que la norme EN 16931 ?", a: "C'est la norme européenne qui définit le modèle de données sémantique pour la facturation électronique. Factur-X en est l'implémentation franco-allemande." },
  { q: "Comment garantir l'intégrité d'une facture ?", a: "Par signature électronique qualifiée, ou par une piste d'audit fiable documentée dans vos processus internes." },
]

export default function VerificateurConformitePage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }))
  const reset = () => setChecked({})

  const totalWeight = CRITERES.reduce((s, c) => s + c.weight, 0)
  const checkedWeight = CRITERES.filter((c) => checked[c.id]).reduce((s, c) => s + c.weight, 0)
  const score = totalWeight > 0 ? Math.round((checkedWeight / totalWeight) * 100) : 0

  const categories = useMemo(() => {
    const cats = new Map<string, typeof CRITERES>()
    for (const c of CRITERES) { if (!cats.has(c.category)) cats.set(c.category, []); cats.get(c.category)!.push(c) }
    return Array.from(cats.entries())
  }, [])

  const tone = score >= 90 ? "ok" : score >= 60 ? "warn" : score > 0 ? "danger" : "neutral"
  const scoreText = { ok: "text-q-ok", warn: "text-q-warn", danger: "text-q-danger", neutral: "text-q-text-4" }[tone]
  const pill = { ok: "q-pill-ok", warn: "q-pill-warn", danger: "q-pill-danger", neutral: "q-pill-neutral" }[tone]
  const scoreLabel = score >= 90 ? "Conforme" : score >= 60 ? "Partiellement conforme" : score > 0 ? "Non conforme" : "Non évalué"
  const ScoreIcon = score >= 90 ? CheckCircle2 : score >= 60 ? AlertTriangle : score > 0 ? XCircle : CircleDashed

  // Jauge circulaire
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Préparez la facture électronique de 2027." />}>
      <OutilsHero
        crumb="Conformité facture"
        icon={<Shield />}
        badge="Critères 2026-2027"
        title="Vérificateur de conformité"
        accent="de facture."
        subtitle="Évaluez votre facture selon les critères de la réforme : format, mentions, Factur-X, archivage."
      />

      <ToolArea width="md">
        <div className="q-card z-10 p-5 sm:p-6 lg:sticky lg:top-[96px]" aria-live="polite">
          <div className="flex items-center gap-5 sm:gap-7">
            <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" className="stroke-[var(--q-line-soft)]" />
                <circle
                  cx="60" cy="60" r="54" fill="none" strokeWidth="8" strokeLinecap="round"
                  stroke="currentColor"
                  className={cn(scoreText, "transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none")}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <span className={cn("absolute inset-0 grid place-items-center font-display text-[28px] font-semibold tracking-[-0.03em] tabular-nums", scoreText)}>
                {score}&nbsp;%
              </span>
            </div>

            <div className="min-w-0">
              <span className={cn("q-pill", pill)}>
                <ScoreIcon aria-hidden />
                {scoreLabel}
              </span>
              <p className="mt-2 text-[14px] text-q-text-3">
                <span className="font-semibold tabular-nums text-q-ink">{CRITERES.filter((c) => checked[c.id]).length} / {CRITERES.length}</span> critères validés
              </p>
              {score < 90 && score > 0 && <p className="mt-1 text-[13px] text-q-text-4">Les critères Factur-X et archivage ont un poids plus élevé.</p>}
              <p className="mt-1 text-[12px] text-q-text-4">Auto-évaluation indicative, d&apos;après vos réponses.</p>
            </div>
          </div>
        </div>

        <Checklist groups={categories} checked={checked} onToggle={toggle} footer={<ResetButton onClick={reset} />} />

        <ToolCta
          className="hidden sm:flex"
          title="Préparez la réforme avec Qonforme"
          text="Vos factures PDF partent avec leurs données Factur-X, les mentions se remplissent depuis vos réglages et vos documents restent consultables. La transmission par plateforme agréée est en préparation."
          cta="Créer mon compte"
        />
      </ToolArea>

      <ToolGuide title="Conformité facture :" accent="les exigences.">
        <Prose>
          <p>Une facture conforme répond à <strong>trois niveaux d&apos;exigences</strong> :</p>
          <ul>
            <li><strong>Mentions obligatoires</strong> : les informations exigées par le Code de commerce et le Code général des impôts</li>
            <li><strong>Format électronique</strong> : entre entreprises, Factur-X, UBL ou CII transmis par une plateforme agréée (réception obligatoire depuis le 1er septembre 2026, émission pour les TPE et PME au 1er septembre 2027)</li>
            <li><strong>Archivage et intégrité</strong> : conservation 10 ans, authenticité garantie (signature ou piste d&apos;audit)</li>
          </ul>
          <p>
            Le format <strong>Factur-X</strong> est le format franco-allemand fondé sur la norme européenne EN 16931. Il contient un PDF lisible par l&apos;humain et un XML lisible par les logiciels comptables.
          </p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" },
            { href: "/outils/calculateur-tva", label: "Calculateur TVA" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Vérificateur conformité facture 2026", "/outils/verificateur-conformite-facture")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
