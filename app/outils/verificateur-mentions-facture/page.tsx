"use client"

import { useMemo, useState } from "react"
import { FileCheck, CheckCircle2 } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, Gauge, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { Checklist, ResetButton, Seg, SwitchRow } from "@/components/outils/controls"
import { PROFIL_MENTIONS_DEFAUT, bilanMentions, mentionsPourProfil, type Mention, type ProfilMentions } from "@/lib/outils/mentions-facture"
import { cn } from "@/lib/utils"

const TAGS: Record<Mention["statut"], string> = {
  obligatoire: "Obligatoire",
  "si-applicable": "Si applicable",
  reforme: "Dès sept. 2027",
}

const FAQ = [
  { q: "Quelle amende pour une mention manquante ?", a: "15 € par mention manquante ou inexacte et par facture, dans la limite du quart du montant de la facture (art. 1737 du CGI)." },
  { q: "L'indemnité de recouvrement de 40 € est-elle obligatoire ?", a: "Sa mention est obligatoire sur les factures adressées à un client professionnel (art. L441-9 et D441-5 du Code de commerce). Elle n'est pas due par un particulier." },
  { q: "Un auto-entrepreneur a-t-il les mêmes obligations ?", a: "Oui, avec la mention « EI » ou « entrepreneur individuel » à côté de son nom et, s'il est en franchise de TVA, la mention « TVA non applicable, art. 293 B du CGI ». Il n'indique alors ni taux ni montant de TVA." },
  { q: "Quelles mentions pour un artisan du bâtiment ?", a: "Son assurance professionnelle : l'assureur, ses coordonnées et la couverture géographique du contrat. Pour l'assurance décennale, l'attestation est jointe à chaque devis et à chaque facture (art. L243-2 du Code des assurances). En sous-traitance, la facture porte la mention « Autoliquidation »." },
]

export default function VerificateurMentionsPage() {
  const [profil, setProfil] = useState<ProfilMentions>(PROFIL_MENTIONS_DEFAUT)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const mentions = useMemo(() => mentionsPourProfil(profil), [profil])
  const bilan = bilanMentions(mentions, checked)

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }))
  const reset = () => setChecked({})
  const maj = (patch: Partial<ProfilMentions>) => setProfil((p) => ({ ...p, ...patch }))

  const groups = useMemo(() => {
    const cats = new Map<string, (Mention & { tag: string })[]>()
    for (const m of mentions) {
      if (!cats.has(m.category)) cats.set(m.category, [])
      cats.get(m.category)!.push({ ...m, tag: TAGS[m.statut] })
    }
    return Array.from(cats.entries())
  }, [mentions])

  const tone = bilan.complet ? "ok" : bilan.pourcentage >= 70 ? "warn" : "danger"
  const scoreText = { ok: "text-q-ok", warn: "text-q-warn", danger: "text-q-danger" }[tone]

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Vos mentions légales sur chaque facture, sans les ressaisir." />}>
      <OutilsHero
        crumb="Mentions obligatoires"
        icon={<FileCheck />}
        badge="Réglementation 2026"
        title="Vérificateur des mentions"
        accent="obligatoires."
        subtitle="Décrivez votre entreprise, puis cochez chaque mention présente sur votre facture : seules les mentions qui vous concernent sont comptées."
      />

      <ToolArea width="md">
        <ToolPanel>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Votre statut">
              <Seg
                label="Statut de l'entreprise"
                value={profil.statut}
                onChange={(statut) => maj({ statut })}
                options={[
                  { value: "ei", label: "Entrepreneur individuel" },
                  { value: "societe", label: "Société" },
                ]}
              />
            </Field>
            <Field label="TVA">
              <Seg
                label="Régime de TVA"
                value={profil.tva}
                onChange={(tva) => maj({ tva, autoliquidation: tva === "franchise" ? false : profil.autoliquidation })}
                options={[
                  { value: "franchise", label: "Franchise" },
                  { value: "assujetti", label: "Je facture la TVA" },
                ]}
              />
            </Field>
            <Field label="Client">
              <Seg
                label="Type de client"
                value={profil.client}
                onChange={(client) => maj({ client })}
                options={[
                  { value: "pro", label: "Professionnel" },
                  { value: "particulier", label: "Particulier" },
                ]}
              />
            </Field>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <SwitchRow checked={profil.batiment} onChange={(batiment) => maj({ batiment })} label="Artisan du bâtiment" desc="Assurance professionnelle (décennale) sur chaque devis et facture." />
            {profil.tva === "assujetti" && (
              <SwitchRow
                checked={profil.autoliquidation}
                onChange={(autoliquidation) => maj({ autoliquidation })}
                label="Sous-traitance de travaux de bâtiment"
                desc="TVA autoliquidée par l'entreprise principale : facture hors taxe avec la mention « Autoliquidation »."
              />
            )}
          </div>
        </ToolPanel>

        {/* Score, collé en haut sur grand écran pendant que l'on coche */}
        <div className="q-card z-10 p-5 sm:p-6 lg:sticky lg:top-[96px]" aria-live="polite">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] text-q-text-4">Mentions obligatoires présentes</p>
              <p className={cn("mt-1 font-display text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums", scoreText)}>{bilan.pourcentage}&nbsp;%</p>
            </div>
            <p className="pb-1 text-right text-[13px] text-q-text-3">
              <span className="font-semibold tabular-nums text-q-ink">
                {bilan.presentes.length} / {bilan.obligatoires.length}
              </span>{" "}
              mentions obligatoires
            </p>
          </div>
          <div className="mt-4">
            <Gauge label="Progression" value="" percent={bilan.pourcentage} tone={tone} />
          </div>
          {bilan.complet ? (
            <p className="q-field-ok mt-3 !text-[14px] font-medium">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Toutes les mentions obligatoires vérifiées sont présentes.
            </p>
          ) : (
            bilan.presentes.length > 0 && (
              <p className="mt-3 text-[13px] text-q-text-3">
                Il manque {bilan.manquantes.length} mention{bilan.manquantes.length > 1 ? "s" : ""} obligatoire{bilan.manquantes.length > 1 ? "s" : ""}, signalée{bilan.manquantes.length > 1 ? "s" : ""} en orange ci-dessous.
              </p>
            )
          )}
          <p className="mt-2 text-[12px] text-q-text-4">« Si applicable » et « Dès sept. 2027 » ne sont pas comptées : vérifiez-les selon votre situation.</p>
        </div>

        <Checklist groups={groups} checked={checked} onToggle={toggle} footer={<ResetButton onClick={reset} />} />

        <ToolCta
          className="hidden sm:flex"
          title="Des factures complètes sans tout ressaisir"
          text="Dans Qonforme, l'identité de votre entreprise, le client, le numéro, les dates, la TVA et les totaux se remplissent seuls ; vos mentions légales (pénalités, indemnité, escompte) s'enregistrent une fois dans vos réglages."
        />
      </ToolArea>

      <ToolGuide title="Mentions obligatoires" accent="sur une facture en 2026.">
        <Prose>
          <p>
            La réglementation française impose des <strong>mentions obligatoires</strong> sur chaque facture. L&apos;absence ou l&apos;inexactitude d&apos;une mention peut entraîner une amende de <strong>15 € par mention</strong> (art. 1737 du CGI), dans la limite du quart du montant de la facture.
          </p>
          <p>
            Certaines dépendent de votre situation : mention RCS et capital pour une société, n° de TVA et TVA ventilée par taux si vous la facturez, « TVA non applicable, art. 293 B du CGI » en franchise, « Autoliquidation » en sous-traitance du bâtiment, assurance professionnelle pour les artisans.
          </p>
          <p>
            Avec la réforme, les factures entre entreprises passent en <strong>facture électronique</strong> (Factur-X, UBL ou CII), par une plateforme agréée : réception obligatoire pour toutes les entreprises depuis le 1er septembre 2026, émission obligatoire pour les TPE et PME à partir du 1er septembre 2027, avec quatre nouvelles mentions (SIREN du client, adresse de livraison, nature des opérations, option sur les débits).
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
