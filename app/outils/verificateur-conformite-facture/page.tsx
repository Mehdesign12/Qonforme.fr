"use client"

import { useEffect, useMemo, useState } from "react"
import { Shield, CheckCircle2, XCircle, AlertTriangle, CircleDashed } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { Checklist, ResetButton, Seg } from "@/components/outils/controls"
import { bilanConformite, criteresPourProfil, factureElectroniqueObligatoire, type Critere, type ProfilConformite } from "@/lib/outils/conformite"
import { cn } from "@/lib/utils"

const TAGS: Record<Critere["statut"], string> = {
  obligatoire: "Obligatoire",
  "a-venir": "À venir",
  "si-applicable": "Si applicable",
}

const FAQ = [
  { q: "Ma facture PDF est-elle encore valable en 2026 ?", a: "Pour une TPE ou une PME, oui jusqu'au 31 août 2027, si elle porte toutes les mentions obligatoires. À partir du 1er septembre 2027, ses factures à des entreprises établies en France doivent être des factures électroniques (Factur-X, UBL ou CII) transmises par une plateforme agréée. Les grandes entreprises et les ETI y sont tenues depuis le 1er septembre 2026, date à laquelle toutes les entreprises doivent aussi pouvoir en recevoir." },
  { q: "Qu'est-ce que la norme EN 16931 ?", a: "C'est la norme européenne qui définit le modèle de données de la facture électronique. Factur-X, UBL et CII en sont des formats." },
  { q: "Combien de temps conserver mes factures ?", a: "Six ans pour l'administration fiscale (art. L102 B du Livre des procédures fiscales) et dix ans au titre des pièces comptables (art. L123-22 du Code de commerce) : en pratique, gardez-les dix ans." },
  { q: "Comment garantir l'intégrité d'une facture ?", a: "Par une piste d'audit fiable documentée dans vos processus, une signature électronique ou l'envoi en facture électronique (art. 289 du CGI)." },
]

function aujourdhui() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function VerificateurConformitePage() {
  const [profil, setProfil] = useState<ProfilConformite>({ taille: "pme", client: "pro", dateEmission: "" })
  // Date du jour posée après le montage (le serveur peut ne pas être au même jour que l'appareil)
  useEffect(() => setProfil((p) => (p.dateEmission ? p : { ...p, dateEmission: aujourdhui() })), [])
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const criteres = useMemo(() => criteresPourProfil(profil), [profil])
  const bilan = bilanConformite(criteres, checked)
  const fe = factureElectroniqueObligatoire(profil)

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }))
  const reset = () => setChecked({})

  const groups = useMemo(() => {
    const cats = new Map<string, (Critere & { tag: string })[]>()
    for (const c of criteres) {
      if (!cats.has(c.category)) cats.set(c.category, [])
      cats.get(c.category)!.push({ ...c, tag: TAGS[c.statut] })
    }
    return Array.from(cats.entries())
  }, [criteres])

  const tone = { complet: "ok", partiel: "warn", insuffisant: "danger", vide: "neutral" }[bilan.niveau] as "ok" | "warn" | "danger" | "neutral"
  const scoreText = { ok: "text-q-ok", warn: "text-q-warn", danger: "text-q-danger", neutral: "text-q-text-4" }[tone]
  const pill = { ok: "q-pill-ok", warn: "q-pill-warn", danger: "q-pill-danger", neutral: "q-pill-neutral" }[tone]
  // Jamais « Conforme » : l'outil constate seulement les critères cochés
  const scoreLabel = { complet: "Tous les critères vérifiés sont remplis", partiel: "Critères obligatoires manquants", insuffisant: "Nombreux critères manquants", vide: "Non évalué" }[bilan.niveau]
  const ScoreIcon = { complet: CheckCircle2, partiel: AlertTriangle, insuffisant: XCircle, vide: CircleDashed }[bilan.niveau]

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (bilan.pourcentage / 100) * circumference

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Préparez la facture électronique de 2027." />}>
      <OutilsHero
        crumb="Conformité facture"
        icon={<Shield />}
        badge="Critères 2026-2027"
        title="Vérificateur de conformité"
        accent="de facture."
        subtitle="Passez votre facture en revue selon les critères de la réforme : mentions, facture électronique, conservation."
      />

      <ToolArea width="md">
        <ToolPanel>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Votre entreprise">
              <Seg
                label="Taille de votre entreprise"
                value={profil.taille}
                onChange={(taille) => setProfil((p) => ({ ...p, taille }))}
                options={[
                  { value: "pme", label: "TPE, PME" },
                  { value: "grande", label: "ETI, grande" },
                ]}
              />
            </Field>
            <Field label="Votre client">
              <Seg
                label="Type de client"
                value={profil.client}
                onChange={(client) => setProfil((p) => ({ ...p, client }))}
                options={[
                  { value: "pro", label: "Entreprise en France" },
                  { value: "autre", label: "Particulier, étranger" },
                ]}
              />
            </Field>
            <Field label="Date d'émission de la facture" htmlFor="conf-date" className="sm:col-span-2">
              <input id="conf-date" type="date" className="q-input sm:max-w-[240px]" value={profil.dateEmission} onChange={(e) => setProfil((p) => ({ ...p, dateEmission: e.target.value }))} />
            </Field>
          </div>
          <p className="mt-4 text-[13px] leading-[1.55] text-q-text-3">
            {profil.client === "autre"
              ? "Facture à un particulier ou à un client établi hors de France : la facture électronique entre entreprises ne s'applique pas."
              : fe
                ? "Cette facture doit être une facture électronique transmise par une plateforme agréée."
                : `Facture électronique pas encore exigée à cette date pour votre entreprise : à partir du ${profil.taille === "grande" ? "1er septembre 2026" : "1er septembre 2027"}.`}
          </p>
        </ToolPanel>

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
                {bilan.pourcentage}&nbsp;%
              </span>
            </div>

            <div className="min-w-0">
              <span className={cn("q-pill", pill)}>
                <ScoreIcon aria-hidden />
                {scoreLabel}
              </span>
              <p className="mt-2 text-[14px] text-q-text-3">
                <span className="font-semibold tabular-nums text-q-ink">
                  {bilan.obligatoires.length - bilan.manquants.length} / {bilan.obligatoires.length}
                </span>{" "}
                critères obligatoires cochés
              </p>
              <p className="mt-1 text-[12px] text-q-text-4">Auto-évaluation indicative, d&apos;après vos réponses : elle ne vaut pas attestation de conformité.</p>
            </div>
          </div>
          {bilan.niveau !== "vide" && bilan.manquants.length > 0 && (
            <div className="mt-4 border-t border-q-line pt-3">
              <p className="text-[13px] font-semibold text-q-ink">Il manque :</p>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[13px] text-q-text-3">
                {bilan.manquants.map((c) => (
                  <li key={c.id}>{c.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Checklist groups={groups} checked={checked} onToggle={toggle} footer={<ResetButton onClick={reset} />} />

        <ToolCta
          className="hidden sm:flex"
          title="Préparez la réforme avec Qonforme"
          text="Vos factures PDF partent avec leurs données Factur-X, les mentions se remplissent depuis vos réglages et vos documents restent consultables. La transmission par plateforme agréée est en préparation."
          cta="Créer mon compte"
        />
      </ToolArea>

      <ToolGuide title="Conformité facture :" accent="les exigences.">
        <Prose>
          <p>Une facture répond à <strong>trois niveaux d&apos;exigences</strong> :</p>
          <ul>
            <li><strong>Mentions obligatoires</strong> : les informations exigées par le Code de commerce et le Code général des impôts, dont la TVA ventilée par taux</li>
            <li><strong>Facture électronique</strong> : entre entreprises établies en France, Factur-X, UBL ou CII transmis par une plateforme agréée (réception obligatoire depuis le 1er septembre 2026 ; émission depuis le 1er septembre 2026 pour les grandes entreprises et les ETI, à partir du 1er septembre 2027 pour les TPE et PME)</li>
            <li><strong>Conservation</strong> : 6 ans pour le contrôle fiscal (art. L102 B du Livre des procédures fiscales), 10 ans pour les pièces comptables (art. L123-22 du Code de commerce), avec une origine authentique et un contenu intègre et lisible (art. 289 du CGI)</li>
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
