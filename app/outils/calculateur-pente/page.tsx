"use client"

import { useMemo, useState } from "react"
import { Ruler } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import {
  Field, Formula, JsonLd, Prose, ResultBox, ResultRow, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd,
} from "@/components/outils/kit"
import { AmountInput, CopyButton, ResetButton, Seg } from "@/components/outils/controls"
import { filtrerSaisieMontant, parseNombre } from "@/lib/outils/montant"
import { denivele as calculerDenivele, penteDepuisDegres, penteDepuisDimensions, penteDepuisPourcent } from "@/lib/outils/chantier"

const fmt = (n: number, d = 2) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(n)

/** Lecture d'un champ : valeur, ou message d'erreur (champ vide = pas d'erreur, pas de valeur). */
function lire(saisie: string, { min = 0, max, strict = false }: { min?: number; max: number; strict?: boolean }): { valeur: number | null; erreur: string } {
  if (saisie.trim() === "") return { valeur: null, erreur: "" }
  const n = parseNombre(saisie)
  if (n === null) return { valeur: null, erreur: "Saisissez un nombre, par exemple 2,5." }
  if (strict ? n <= min : n < min) return { valeur: null, erreur: strict ? "La valeur doit être supérieure à zéro." : "La valeur ne peut pas être négative." }
  if (n > max) return { valeur: null, erreur: `Valeur trop grande (${fmt(max, 0)} au plus).` }
  return { valeur: n, erreur: "" }
}

const FAQ = [
  {
    q: "Comment calculer une pente en pourcentage ?",
    a: "Divisez le dénivelé par la distance horizontale, puis multipliez par 100. Exemple : 0,5 m de dénivelé sur 10 m à plat, c'est 0,5 ÷ 10 × 100 = 5 %. Les deux longueurs doivent être dans la même unité.",
  },
  {
    q: "Comment passer des degrés aux pourcentages ?",
    a: "Le pourcentage vaut la tangente de l'angle multipliée par 100 : 10° font environ 17,6 %, 45° font exactement 100 %. Dans l'autre sens, l'angle est l'arc tangente de la pente divisée par 100 : 5 % font environ 2,86°.",
  },
  {
    q: "Quelle différence entre la distance horizontale et la longueur de la pente ?",
    a: "La pente se calcule sur la distance horizontale, mesurée à plat. La longueur de la pente, le long de la surface inclinée (celle d'un rampant de toiture ou d'une rampe), est un peu plus longue : c'est l'hypoténuse du triangle formé par le dénivelé et la distance horizontale.",
  },
  {
    q: "Que veut dire « une pente de 1 pour 10 » ?",
    a: "Un mètre de dénivelé tous les dix mètres à plat, soit 10 %. Le rapport « 1 pour n » s'obtient en divisant la distance horizontale par le dénivelé.",
  },
  {
    q: "Comment mesurer le dénivelé sur un chantier ?",
    a: "Posez une règle ou un niveau parfaitement horizontal à partir du point haut, puis mesurez la hauteur qui la sépare du point bas. Un niveau laser donne la même mesure plus vite sur de longues distances.",
  },
]

type Mode = "dimensions" | "pente"
type Unite = "m" | "cm"
type UnitePente = "pourcent" | "degres"

export default function CalculateurPentePage() {
  const [mode, setMode] = useState<Mode>("dimensions")
  const [unite, setUnite] = useState<Unite>("m")
  const [deniveleSaisi, setDeniveleSaisi] = useState("")
  const [distanceSaisie, setDistanceSaisie] = useState("")
  const [unitePente, setUnitePente] = useState<UnitePente>("pourcent")
  const [penteSaisie, setPenteSaisie] = useState("")

  const LONGUEUR_MAX = 1_000_000
  const dn = lire(deniveleSaisi, { min: 0, max: LONGUEUR_MAX })
  const di = lire(distanceSaisie, { min: 0, max: LONGUEUR_MAX, strict: true })
  const pe = lire(penteSaisie, unitePente === "pourcent" ? { min: 0, max: 100_000 } : { min: 0, max: 89.99 })

  const resultat = useMemo(() => {
    if (mode === "dimensions") {
      if (dn.valeur === null || di.valeur === null) return null
      const p = penteDepuisDimensions(dn.valeur, di.valeur)
      return { pente: p, denivele: dn.valeur, distance: di.valeur, inclinee: p.longueurInclinee }
    }
    if (pe.valeur === null) return null
    const pente = unitePente === "pourcent" ? penteDepuisPourcent(pe.valeur) : penteDepuisDegres(pe.valeur)
    if (di.valeur === null) return { pente, denivele: null, distance: null, inclinee: null }
    const d = calculerDenivele(di.valeur, pente.pourcent)
    return { pente, denivele: d.denivele, distance: di.valeur, inclinee: d.longueurInclinee }
  }, [mode, dn.valeur, di.valeur, pe.valeur, unitePente])

  const reinitialiser = () => {
    setDeniveleSaisi("")
    setDistanceSaisie("")
    setPenteSaisie("")
  }

  const rapport = resultat?.pente.rapport
  const texteCopie = resultat
    ? [
        `Pente : ${fmt(resultat.pente.pourcent)} %`,
        `Angle : ${fmt(resultat.pente.degres)}°`,
        rapport ? `Rapport : 1 pour ${fmt(rapport, 1)}` : null,
        resultat.denivele !== null ? `Dénivelé : ${fmt(resultat.denivele)} ${unite}` : null,
      ]
        .filter(Boolean)
        .join(" | ")
    : ""

  const champDistance = (hint: string, optionnel?: boolean) => (
    <Field label={optionnel ? "Distance horizontale (facultatif)" : "Distance horizontale"} htmlFor="pente-distance" className="mt-5" hint={di.erreur ? undefined : hint}>
      <AmountInput id="pente-distance" value={distanceSaisie} onChange={(v) => setDistanceSaisie(filtrerSaisieMontant(v))} suffix={unite} placeholder="10" ariaDescribedBy={di.erreur ? "pente-distance-err" : undefined} invalid={!!di.erreur} />
      {di.erreur && <p id="pente-distance-err" className="q-field-error">{di.erreur}</p>}
    </Field>
  )

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Reportez vos mesures dans un devis détaillé, en quelques minutes." />}>
      <OutilsHero
        crumb="Calculateur de pente"
        icon={<Ruler />}
        badge="Pourcentage et degrés"
        title="Calculateur de pente"
        accent="en % et en degrés."
        subtitle="Du dénivelé et de la distance à la pente, ou d'une pente connue au dénivelé. Rampe d'accès, toiture, terrassement, écoulement : le résultat s'affiche en pourcentage, en degrés et en « 1 pour n »."
      />

      <ToolArea>
        <ToolPanel>
          <Seg
            label="Ce que je veux calculer"
            value={mode}
            onChange={(m) => setMode(m)}
            options={[
              { value: "dimensions", label: "La pente" },
              { value: "pente", label: "Le dénivelé" },
            ]}
          />

          <Field label="Unité des longueurs" className="mt-5">
            <Seg
              label="Unité des longueurs"
              value={unite}
              onChange={(u) => setUnite(u)}
              options={[
                { value: "m", label: "Mètres" },
                { value: "cm", label: "Centimètres" },
              ]}
            />
          </Field>

          {mode === "dimensions" ? (
            <>
              <Field label="Dénivelé" htmlFor="pente-denivele" className="mt-5" hint={dn.erreur ? undefined : "La hauteur à rattraper : l'écart vertical entre le point bas et le point haut."}>
                <AmountInput id="pente-denivele" value={deniveleSaisi} onChange={(v) => setDeniveleSaisi(filtrerSaisieMontant(v))} suffix={unite} placeholder="1" autoFocus ariaDescribedBy={dn.erreur ? "pente-denivele-err" : undefined} invalid={!!dn.erreur} />
                {dn.erreur && <p id="pente-denivele-err" className="q-field-error">{dn.erreur}</p>}
              </Field>
              {champDistance("Mesurée à plat, et non le long de la pente.")}
            </>
          ) : (
            <>
              <Field label="Unité de la pente" className="mt-5">
                <Seg
                  label="Unité de la pente"
                  value={unitePente}
                  onChange={(u) => { setUnitePente(u); setPenteSaisie("") }}
                  options={[
                    { value: "pourcent", label: "Pourcentage" },
                    { value: "degres", label: "Degrés" },
                  ]}
                />
              </Field>
              <Field label="Pente connue" htmlFor="pente-valeur" className="mt-5" hint={pe.erreur ? undefined : unitePente === "pourcent" ? "Par exemple 5 pour une pente de 5 %." : "De 0 à moins de 90 degrés."}>
                <AmountInput id="pente-valeur" value={penteSaisie} onChange={(v) => setPenteSaisie(filtrerSaisieMontant(v))} suffix={unitePente === "pourcent" ? "%" : "°"} placeholder={unitePente === "pourcent" ? "5" : "10"} autoFocus ariaDescribedBy={pe.erreur ? "pente-valeur-err" : undefined} invalid={!!pe.erreur} />
                {pe.erreur && <p id="pente-valeur-err" className="q-field-error">{pe.erreur}</p>}
              </Field>
              {champDistance("Pour obtenir le dénivelé : la distance mesurée à plat.", true)}
            </>
          )}

          <div className="mt-6">
            {resultat ? (
              <ResultBox
                label="Pente"
                value={`${fmt(resultat.pente.pourcent)} %`}
                sub={`soit ${fmt(resultat.pente.degres)}° avec l'horizontale`}
                footer={
                  <>
                    <ResetButton onClick={reinitialiser} />
                    <CopyButton text={texteCopie} />
                  </>
                }
              >
                <ResultRow label="Angle" value={`${fmt(resultat.pente.degres)}°`} />
                <ResultRow label="Rapport" value={rapport ? `1 pour ${fmt(rapport, 1)}` : "Pente nulle"} />
                <ResultRow label="Dénivelé par mètre à plat" value={`${fmt(resultat.pente.cmParMetre)} cm`} />
                {resultat.denivele !== null && <ResultRow label="Dénivelé" value={`${fmt(resultat.denivele)} ${unite}`} tone="accent" strong divider />}
                {resultat.inclinee !== null && <ResultRow label="Longueur le long de la pente" value={`${fmt(resultat.inclinee)} ${unite}`} />}
              </ResultBox>
            ) : (
              <p className="rounded-2xl border border-dashed border-q-field px-5 py-6 text-center text-[14px] text-q-text-4">
                {mode === "dimensions" ? "Saisissez le dénivelé et la distance : la pente s'affiche ici." : "Saisissez une pente : ses équivalents s'affichent ici."}
              </p>
            )}
          </div>
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Un chantier à chiffrer ?"
          text="Reportez vos mesures dans un devis détaillé : fournitures, main-d'œuvre, TVA par ligne. Les devis sont gratuits et illimités."
        />
      </ToolArea>

      <ToolGuide title="Comment calculer" accent="une pente ?">
        <Prose>
          <p>
            Une pente compare <strong>la hauteur</strong> que l&apos;on monte ou descend à <strong>la distance parcourue à plat</strong>. On l&apos;exprime en pourcentage, en degrés ou en rapport « 1 pour n ».
          </p>
          <h3>Formules</h3>
          <Formula>
            <p>Pente (%) = dénivelé ÷ distance horizontale × 100</p>
            <p>Angle (°) = arc tangente (dénivelé ÷ distance horizontale)</p>
            <p>Rapport « 1 pour n » : n = distance horizontale ÷ dénivelé</p>
            <p>Longueur le long de la pente = √(dénivelé² + distance horizontale²)</p>
          </Formula>
          <h3>Repères</h3>
          <ul>
            <li><strong>1 %</strong> : 1 cm de dénivelé par mètre à plat, environ 0,57°.</li>
            <li><strong>10 %</strong> : 10 cm par mètre, 1 pour 10, environ 5,71°.</li>
            <li><strong>45°</strong> : 100 %, 1 pour 1.</li>
          </ul>
          <p>
            Les pentes exigées dépendent de l&apos;ouvrage : rampe d&apos;accès, évacuation des eaux, couverture. Référez-vous aux règles de l&apos;art, aux documents techniques du fabricant et à la réglementation qui s&apos;applique à votre chantier.
          </p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-beton", label: "Calculateur de béton" },
            { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
            { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis gratuit" },
            { href: "/guide/comment-faire-un-devis", label: "Guide : comment faire un devis" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Calculateur de pente en % et en degrés", "/outils/calculateur-pente", "Calcul d'une pente en pourcentage, en degrés et en rapport 1 pour n, ou du dénivelé d'une pente connue.")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
