"use client"

import { useState } from "react"
import { Hash } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Field, JsonLd, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { ChoiceGroup, CopyButton } from "@/components/outils/controls"
import { FORMATS_NUMERO, genererNumeros, validerParametresNumero, type FormatNumero } from "@/lib/outils/numero-facture"

const FAQ = [
  { q: "Puis-je recommencer à 1 chaque année ?", a: "Oui, à condition d'inclure l'année dans le numéro (ex. : F-2026-001). Le numéro reste unique et la séquence continue dans l'année." },
  { q: "Que faire d'une facture émise par erreur ?", a: "Elle ne se supprime pas et son numéro ne se réutilise pas : on l'annule par un avoir. Ainsi, la séquence reste continue." },
  { q: "Puis-je utiliser des lettres ?", a: "Oui, aucun format n'est imposé. Lettres, chiffres et tirets sont permis tant que chaque numéro est unique et que la séquence est chronologique et continue." },
]

export default function GenerateurNumeroFacturePage() {
  const [format, setFormat] = useState<FormatNumero>("standard")
  const [prefixe, setPrefixe] = useState("F")
  const [annee, setAnnee] = useState(new Date().getFullYear().toString())
  const [mois, setMois] = useState((new Date().getMonth() + 1).toString().padStart(2, "0"))
  const [compteur, setCompteur] = useState("1")
  const [digits, setDigits] = useState("3")

  const params = { format, prefixe, annee, mois, compteur, chiffres: Number(digits) }
  const erreurs = validerParametresNumero(params)
  const sequence = genererNumeros(params, 5)
  const numero = sequence[0] ?? ""
  const formatChoisi = FORMATS_NUMERO.find((f) => f.id === format)!

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
            {numero ? (
              <>
                <p className="mt-2 break-all font-mono text-[26px] font-medium tracking-[0.02em] text-q-ink sm:text-[30px]">{numero}</p>
                <CopyButton text={numero} label="Copier" className="mt-2" />
              </>
            ) : (
              <p className="mt-2 text-[15px] text-q-text-3">Corrigez les champs signalés pour obtenir le numéro.</p>
            )}
          </div>

          <Field label="Format" className="mt-6">
            <ChoiceGroup
              label="Format"
              columns={2}
              dot={false}
              value={format}
              onChange={setFormat}
              options={FORMATS_NUMERO.map((f) => ({ value: f.id, label: <span className="font-mono">{f.label}</span>, desc: f.desc }))}
            />
          </Field>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {formatChoisi.prefixe && (
              <Field label="Préfixe" htmlFor="num-prefixe">
                <input
                  id="num-prefixe"
                  className="q-input font-mono"
                  maxLength={12}
                  value={prefixe}
                  onChange={(e) => setPrefixe(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="F"
                  aria-invalid={erreurs.prefixe ? true : undefined}
                  aria-describedby={erreurs.prefixe ? "num-prefixe-err" : undefined}
                />
                {erreurs.prefixe && <p id="num-prefixe-err" className="q-field-error">{erreurs.prefixe}</p>}
              </Field>
            )}
            {format !== "prefix" && (
              <Field label="Année" htmlFor="num-annee">
                <input
                  id="num-annee"
                  className="q-input font-mono"
                  inputMode="numeric"
                  maxLength={4}
                  value={annee}
                  onChange={(e) => setAnnee(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={erreurs.annee ? true : undefined}
                  aria-describedby={erreurs.annee ? "num-annee-err" : undefined}
                />
                {erreurs.annee && <p id="num-annee-err" className="q-field-error">{erreurs.annee}</p>}
              </Field>
            )}
            {formatChoisi.mois && (
              <Field label="Mois" htmlFor="num-mois">
                <select id="num-mois" className="q-input" value={mois} onChange={(e) => setMois(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i} value={(i + 1).toString().padStart(2, "0")}>{(i + 1).toString().padStart(2, "0")} — {new Date(2026, i).toLocaleString("fr-FR", { month: "long" })}</option>)}
                </select>
              </Field>
            )}
            <Field label="Compteur de départ" htmlFor="num-compteur">
              <input
                id="num-compteur"
                type="text"
                inputMode="numeric"
                className="q-input font-mono"
                value={compteur}
                onChange={(e) => setCompteur(e.target.value.replace(/[^\d-]/g, ""))}
                aria-invalid={erreurs.compteur ? true : undefined}
                aria-describedby={erreurs.compteur ? "num-compteur-err" : undefined}
              />
              {erreurs.compteur && <p id="num-compteur-err" className="q-field-error">{erreurs.compteur}</p>}
            </Field>
            <Field label="Nombre de chiffres" htmlFor="num-digits">
              <select id="num-digits" className="q-input" value={digits} onChange={(e) => setDigits(e.target.value)}>
                <option value="2">2 (01)</option><option value="3">3 (001)</option><option value="4">4 (0001)</option><option value="5">5 (00001)</option>
              </select>
            </Field>
          </div>

          {sequence.length > 0 && (
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
          )}
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Une numérotation qui suit toute seule"
          text="Qonforme numérote vos devis et vos factures à la suite, sans doublon : vous n'avez plus à tenir le compteur."
        />
      </ToolArea>

      <ToolGuide title="Règles de numérotation" accent="des factures.">
        <Prose>
          <p>
            Chaque facture porte « un numéro unique basé sur une séquence chronologique et continue » (<strong>CGI, annexe II, art. 242 nonies A, I-7°</strong>) :
          </p>
          <ul>
            <li><strong>Chronologique</strong> : les numéros suivent l&apos;ordre d&apos;émission</li>
            <li><strong>Continue</strong> : aucun « trou » dans la séquence</li>
            <li><strong>Unique</strong> : chaque numéro ne sert qu&apos;une seule fois</li>
          </ul>
          <p>
            Vous pouvez utiliser n&apos;importe quel format (chiffres, lettres, tirets) tant que ces trois règles sont respectées. Plusieurs séries distinctes sont permises quand votre activité le justifie (par exemple une série par établissement).
          </p>
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
