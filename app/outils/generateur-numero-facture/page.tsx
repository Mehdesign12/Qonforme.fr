"use client"

import { useState } from "react"
import { Hash } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { ChoiceGroup, CopyButton } from "@/components/outils/controls"

const FORMATS = [
  { id: "standard", label: "F-AAAA-NNN", example: "F-2026-001", desc: "Format classique avec préfixe + année + compteur" },
  { id: "compact", label: "AAAAMMNNN", example: "202604001", desc: "Année + mois + compteur (sans séparateur)" },
  { id: "prefix", label: "PRE-NNN", example: "FAC-001", desc: "Préfixe personnalisé + compteur" },
  { id: "full", label: "PRE-AAAA-MM-NNN", example: "FAC-2026-04-001", desc: "Préfixe + année + mois + compteur" },
]

const FAQ = [
  { q: "Puis-je recommencer à 1 chaque année ?", a: "Oui, à condition d'inclure l'année dans le numéro (ex: F-2026-001). Cela garantit l'unicité." },
  { q: "Que faire si j'ai un trou dans ma numérotation ?", a: "Un trou peut attirer l'attention du fisc. Documentez la raison (facture annulée) et conservez la trace." },
  { q: "Puis-je utiliser des lettres ?", a: "Oui, la loi n'impose aucun format. Lettres, chiffres, tirets sont autorisés tant que la séquence est chronologique." },
]

export default function GenerateurNumeroFacturePage() {
  const [format, setFormat] = useState("standard")
  const [prefixe, setPrefixe] = useState("F")
  const [annee, setAnnee] = useState(new Date().getFullYear().toString())
  const [mois, setMois] = useState((new Date().getMonth() + 1).toString().padStart(2, "0"))
  const [compteur, setCompteur] = useState("1")
  const [digits, setDigits] = useState("3")

  const numCompteur = parseInt(compteur) || 1
  const numDigits = parseInt(digits) || 3
  const paddedCompteur = numCompteur.toString().padStart(numDigits, "0")

  const generateNumero = (): string => {
    switch (format) {
      case "standard": return `${prefixe}-${annee}-${paddedCompteur}`
      case "compact": return `${annee}${mois}${paddedCompteur}`
      case "prefix": return `${prefixe}-${paddedCompteur}`
      case "full": return `${prefixe}-${annee}-${mois}-${paddedCompteur}`
      default: return paddedCompteur
    }
  }

  const numero = generateNumero()

  // Aperçu de la séquence
  const sequence = Array.from({ length: 5 }, (_, i) => {
    const n = (numCompteur + i).toString().padStart(numDigits, "0")
    switch (format) {
      case "standard": return `${prefixe}-${annee}-${n}`
      case "compact": return `${annee}${mois}${n}`
      case "prefix": return `${prefixe}-${n}`
      case "full": return `${prefixe}-${annee}-${mois}-${n}`
      default: return n
    }
  })

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Vos factures numérotées à la suite, sans y penser." />}>
      <OutilsHero
        crumb="Générateur n° de facture"
        icon={<Hash />}
        badge="Numérotation continue"
        title="Générateur de numéro"
        accent="de facture."
        subtitle="Générez un numéro de facture conforme à la réglementation : chronologique, sans rupture, personnalisable."
      />

      <ToolArea>
        <ToolPanel>
          {/* Résultat en tête */}
          <div className="rounded-2xl border border-q-line bg-q-surface-2 px-5 py-6 text-center" aria-live="polite">
            <p className="text-[13px] text-q-text-4">Votre numéro de facture</p>
            <p className="mt-2 break-all font-mono text-[26px] font-medium tracking-[0.02em] text-q-ink sm:text-[30px]">{numero}</p>
            <CopyButton text={numero} label="Copier" className="mt-2" />
          </div>

          <Field label="Format" className="mt-6">
            <ChoiceGroup
              label="Format"
              columns={2}
              dot={false}
              value={format}
              onChange={setFormat}
              options={FORMATS.map((f) => ({ value: f.id, label: <span className="font-mono">{f.label}</span>, desc: f.desc }))}
            />
          </Field>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {format !== "compact" && (
              <Field label="Préfixe" htmlFor="num-prefixe">
                <input id="num-prefixe" className="q-input font-mono" value={prefixe} onChange={(e) => setPrefixe(e.target.value.toUpperCase())} placeholder="F" />
              </Field>
            )}
            <Field label="Année" htmlFor="num-annee">
              <input id="num-annee" className="q-input font-mono" value={annee} onChange={(e) => setAnnee(e.target.value)} />
            </Field>
            {(format === "compact" || format === "full") && (
              <Field label="Mois" htmlFor="num-mois">
                <select id="num-mois" className="q-input" value={mois} onChange={(e) => setMois(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i} value={(i + 1).toString().padStart(2, "0")}>{(i + 1).toString().padStart(2, "0")} — {new Date(2026, i).toLocaleString("fr-FR", { month: "long" })}</option>)}
                </select>
              </Field>
            )}
            <Field label="Compteur de départ" htmlFor="num-compteur">
              <input id="num-compteur" type="number" min={1} className="q-input font-mono" value={compteur} onChange={(e) => setCompteur(e.target.value)} />
            </Field>
            <Field label="Nombre de chiffres" htmlFor="num-digits">
              <select id="num-digits" className="q-input" value={digits} onChange={(e) => setDigits(e.target.value)}>
                <option value="2">2 (01)</option><option value="3">3 (001)</option><option value="4">4 (0001)</option><option value="5">5 (00001)</option>
              </select>
            </Field>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-q-line">
            <p className="border-b border-q-line bg-q-surface-2 px-4 py-2.5 text-[13px] font-semibold text-q-text-3 sm:px-5">Aperçu de la séquence</p>
            <ul className="q-list">
              {sequence.map((n) => (
                <li key={n} className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-1.5 sm:px-5">
                  <span className="font-mono text-[14px] text-q-ink">{n}</span>
                  <CopyButton text={n} label={`Copier ${n}`} iconOnly />
                </li>
              ))}
            </ul>
          </div>
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Une numérotation qui suit toute seule"
          text="Qonforme numérote vos devis et vos factures à la suite, sans doublon : vous n'avez plus à tenir le compteur."
        />
      </ToolArea>

      <ToolGuide title="Règles de numérotation" accent="des factures.">
        <Prose>
          <p>La numérotation des factures est encadrée par le <strong>Code de commerce (art. L441-9)</strong> :</p>
          <ul>
            <li><strong>Chronologique</strong> : les numéros doivent suivre un ordre croissant</li>
            <li><strong>Sans rupture</strong> : aucun « trou » dans la séquence</li>
            <li><strong>Unique</strong> : chaque numéro ne peut être utilisé qu&apos;une seule fois</li>
          </ul>
          <p>Vous pouvez utiliser n&apos;importe quel format (chiffres, lettres, tirets) tant que ces 3 règles sont respectées.</p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions" },
            { href: "/outils/generateur-conditions-paiement", label: "Conditions de paiement" },
            { href: "/outils/verification-siret", label: "Vérificateur SIRET" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Générateur numéro de facture conforme", "/outils/generateur-numero-facture")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
