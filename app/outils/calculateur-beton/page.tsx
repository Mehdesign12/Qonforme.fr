"use client"

import { useMemo, useState } from "react"
import { Layers } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import {
  Callout, Field, Formula, JsonLd, PanelTitle, Prose, ResultBox, ResultRow, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd,
} from "@/components/outils/kit"
import { AmountInput, ChoiceGroup, CopyButton, ResetButton, Seg } from "@/components/outils/controls"
import { filtrerSaisieMontant, parseNombre } from "@/lib/outils/montant"
import {
  DOSAGES, MASSE_VOLUMIQUE_BETON, SAC_CIMENT_KG, avecMarge, composition, masseTonnes, volumeCylindres, volumeRectangulaire, type Dosage,
} from "@/lib/outils/chantier"

const fmt = (n: number, d = 2) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(n)

/** Lecture d'un champ : valeur, ou message d'erreur (champ vide = pas d'erreur, pas de valeur). */
function lire(saisie: string, { max, entier = false, zeroPermis = false }: { max: number; entier?: boolean; zeroPermis?: boolean }): { valeur: number | null; erreur: string } {
  if (saisie.trim() === "") return { valeur: null, erreur: "" }
  const n = parseNombre(saisie)
  if (n === null) return { valeur: null, erreur: "Saisissez un nombre, par exemple 2,5." }
  if (zeroPermis ? n < 0 : n <= 0) return { valeur: null, erreur: zeroPermis ? "La valeur ne peut pas être négative." : "La valeur doit être supérieure à zéro." }
  if (n > max) return { valeur: null, erreur: `Valeur trop grande (${fmt(max, 0)} au plus).` }
  if (entier && !Number.isInteger(n)) return { valeur: null, erreur: "Saisissez un nombre entier." }
  return { valeur: n, erreur: "" }
}

const FAQ = [
  {
    q: "Comment calculer le volume de béton d'une dalle ?",
    a: "Multipliez la longueur par la largeur par l'épaisseur, en mètres. Exemple : une dalle de 5 m sur 4 m et de 12 cm d'épaisseur (0,12 m) représente 5 × 4 × 0,12 = 2,4 m³.",
  },
  {
    q: "Quelle marge prévoir au-delà du volume calculé ?",
    a: "Les professionnels ajoutent couramment de 5 à 10 %. Le fond de forme n'est jamais parfaitement plan, le coffrage bouge un peu et une partie du béton reste dans les outils : mieux vaut commander un peu trop que manquer de béton en cours de coulage.",
  },
  {
    q: "Combien pèse un mètre cube de béton ?",
    a: "Environ 2,4 tonnes pour un béton courant. C'est un ordre de grandeur : selon les granulats, la masse volumique varie de 2,3 à 2,5 tonnes par m³. Comptez-le pour le transport et l'accès du chantier.",
  },
  {
    q: "Quel dosage de ciment choisir ?",
    a: "Il dépend de l'ouvrage et de la résistance visée. Pour un ouvrage porteur ou armé, suivez les prescriptions du plan ou du bureau d'études. Les dosages de 250, 300 et 350 kg de ciment par mètre cube sont les plus courants pour un béton fabriqué sur place.",
  },
  {
    q: "Faut-il fabriquer le béton soi-même ou le commander en toupie ?",
    a: "Au-delà de quelques mètres cubes, ou pour un béton armé ou porteur, un béton prêt à l'emploi livré en toupie avec la classe de résistance prescrite est plus régulier et bien plus rapide à couler. La composition de cet outil sert surtout aux petits volumes.",
  },
]

type Forme = "dalle" | "poteaux"

export default function CalculateurBetonPage() {
  const [forme, setForme] = useState<Forme>("dalle")
  const [longueur, setLongueur] = useState("")
  const [largeur, setLargeur] = useState("")
  const [epaisseur, setEpaisseur] = useState("")
  const [diametre, setDiametre] = useState("")
  const [hauteur, setHauteur] = useState("")
  const [nombre, setNombre] = useState("1")
  const [marge, setMarge] = useState("5")
  const [dosage, setDosage] = useState<Dosage>(350)

  const lg = lire(longueur, { max: 10_000 })
  const la = lire(largeur, { max: 10_000 })
  const ep = lire(epaisseur, { max: 500 })
  const di = lire(diametre, { max: 500 })
  const ha = lire(hauteur, { max: 1_000 })
  const nb = lire(nombre, { max: 10_000, entier: true })
  const ma = lire(marge, { max: 100, zeroPermis: true })

  const resultat = useMemo(() => {
    const net =
      forme === "dalle"
        ? lg.valeur !== null && la.valeur !== null && ep.valeur !== null
          ? volumeRectangulaire(lg.valeur, la.valeur, ep.valeur)
          : null
        : di.valeur !== null && ha.valeur !== null && nb.valeur !== null
          ? volumeCylindres(di.valeur, ha.valeur, nb.valeur)
          : null
    // Marge vide : 0 % ; marge fautive : pas de résultat tant qu'elle n'est pas corrigée
    if (net === null || ma.erreur) return null
    const commande = avecMarge(net, ma.valeur ?? 0)
    return { net, commande, tonnes: masseTonnes(commande), compo: composition(commande, dosage) }
  }, [forme, lg.valeur, la.valeur, ep.valeur, di.valeur, ha.valeur, nb.valeur, ma.valeur, ma.erreur, dosage])

  const reinitialiser = () => {
    setLongueur(""); setLargeur(""); setEpaisseur(""); setDiametre(""); setHauteur(""); setNombre("1"); setMarge("5")
  }

  const champ = (id: string, label: string, valeur: string, set: (v: string) => void, l: { erreur: string }, suffix: string, placeholder: string, hint?: string, autoFocus?: boolean) => (
    <Field label={label} htmlFor={id} className="mt-5" hint={l.erreur ? undefined : hint}>
      <AmountInput id={id} value={valeur} onChange={(v) => set(filtrerSaisieMontant(v))} suffix={suffix} placeholder={placeholder} autoFocus={autoFocus} ariaDescribedBy={l.erreur ? `${id}-err` : undefined} invalid={!!l.erreur} />
      {l.erreur && <p id={`${id}-err`} className="q-field-error">{l.erreur}</p>}
    </Field>
  )

  const texteCopie = resultat
    ? `Béton : ${fmt(resultat.net, 3)} m³ (${fmt(resultat.commande, 3)} m³ avec ${fmt(ma.valeur ?? 0, 1)} % de marge) | Ciment : ${fmt(resultat.compo.cimentKg, 0)} kg (${resultat.compo.sacs} sacs de ${SAC_CIMENT_KG} kg) | Sable 0/4 : ${fmt(resultat.compo.sableM3)} m³ | Gravillons 4/20 : ${fmt(resultat.compo.gravillonsM3)} m³ | Eau : ${fmt(resultat.compo.eauLitres, 0)} L`
    : ""

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="Reportez vos quantités dans un devis détaillé, en quelques minutes." />}>
      <OutilsHero
        crumb="Calculateur de béton"
        icon={<Layers />}
        badge="Volume, ciment et dosage"
        title="Calculateur de béton"
        accent="volume et dosage."
        subtitle="Le volume de béton d'une dalle, d'une semelle ou de poteaux, avec une marge de perte, puis le ciment, le sable, les gravillons et l'eau pour le fabriquer sur place."
      />

      <ToolArea>
        <ToolPanel>
          <PanelTitle>Ce que vous coulez</PanelTitle>
          <Seg
            label="Forme de l'ouvrage"
            value={forme}
            onChange={(f) => setForme(f)}
            options={[
              { value: "dalle", label: "Dalle, semelle" },
              { value: "poteaux", label: "Poteaux, plots" },
            ]}
          />

          {forme === "dalle" ? (
            <>
              {champ("beton-longueur", "Longueur", longueur, setLongueur, lg, "m", "5", undefined, true)}
              {champ("beton-largeur", "Largeur", largeur, setLargeur, la, "m", "4")}
              {champ("beton-epaisseur", "Épaisseur", epaisseur, setEpaisseur, ep, "cm", "12", "Une dalle de terrasse ou de garage fait souvent de 10 à 15 cm.")}
            </>
          ) : (
            <>
              {champ("beton-diametre", "Diamètre d'un poteau", diametre, setDiametre, di, "cm", "30", undefined, true)}
              {champ("beton-hauteur", "Hauteur", hauteur, setHauteur, ha, "m", "2")}
              {champ("beton-nombre", "Nombre de poteaux", nombre, setNombre, nb, "", "1")}
            </>
          )}

          {champ("beton-marge", "Marge de perte", marge, setMarge, ma, "%", "5", "De 5 à 10 % : fond de forme irrégulier, coffrage, pertes au coulage.")}

          <Field label="Dosage en ciment" className="mt-5" hint="Kilogrammes de ciment par mètre cube de béton fabriqué sur place.">
            <ChoiceGroup
              label="Dosage en ciment"
              value={dosage}
              onChange={setDosage}
              options={DOSAGES.map((d) => ({
                value: d,
                label: `${d} kg/m³`,
                desc: d === 250 ? "Remplissage, béton non armé" : d === 300 ? "Fondations, dallage" : "Dalle, poteau, béton armé",
              }))}
            />
          </Field>

          <div className="mt-6">
            {resultat ? (
              <ResultBox
                label="Volume de béton à commander"
                value={`${fmt(resultat.commande)} m³`}
                sub={`${fmt(resultat.net, 3)} m³ de volume net, plus ${fmt(ma.valeur ?? 0, 1)} % de marge. Environ ${fmt(resultat.tonnes, 1)} t à transporter.`}
                footer={
                  <>
                    <ResetButton onClick={reinitialiser} />
                    <CopyButton text={texteCopie} />
                  </>
                }
              >
                <ResultRow label={`Ciment (${dosage} kg/m³)`} value={`${fmt(resultat.compo.cimentKg, 0)} kg`} />
                <ResultRow label={`Sacs de ${SAC_CIMENT_KG} kg`} value={`${resultat.compo.sacs}`} tone="accent" strong />
                <ResultRow label="Sable 0/4 (en vrac)" value={`${fmt(resultat.compo.sableM3)} m³`} />
                <ResultRow label="Gravillons 4/20 (en vrac)" value={`${fmt(resultat.compo.gravillonsM3)} m³`} />
                <ResultRow label="Eau" value={`${fmt(resultat.compo.eauLitres, 0)} L`} />
              </ResultBox>
            ) : (
              <p className="rounded-2xl border border-dashed border-q-field px-5 py-6 text-center text-[14px] text-q-text-4">
                Saisissez les dimensions : le volume de béton, le ciment, le sable, les gravillons et l&apos;eau s&apos;affichent ici.
              </p>
            )}
          </div>

          {resultat && (
            <Callout tone="info" className="mt-4">
              Quantités indicatives. Pour un ouvrage porteur ou armé, ou au-delà de quelques mètres cubes, commandez un béton prêt à l&apos;emploi avec la classe de résistance prescrite.
            </Callout>
          )}
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Un chantier à chiffrer ?"
          text="Reportez vos quantités dans un devis détaillé : fournitures, main-d'œuvre, TVA par ligne. Les devis sont gratuits et illimités."
        />
      </ToolArea>

      <ToolGuide title="Comment calculer" accent="un volume de béton ?">
        <Prose>
          <p>
            Le volume de béton d&apos;un ouvrage est le volume du coffrage à remplir. On le calcule en <strong>mètres cubes</strong>, puis on ajoute une marge pour ne pas manquer de béton en cours de coulage.
          </p>
          <h3>Formules</h3>
          <Formula>
            <p>Dalle ou semelle : volume (m³) = longueur (m) × largeur (m) × épaisseur (m)</p>
            <p>Poteau cylindrique : volume (m³) = π × rayon² (m) × hauteur (m) × nombre de poteaux</p>
            <p>Volume à commander = volume × (1 + marge ÷ 100)</p>
          </Formula>
          <p>L&apos;épaisseur se mesure souvent en centimètres sur un chantier : 12 cm font 0,12 m. L&apos;outil fait la conversion.</p>
          <h3>Composition indicative pour fabriquer 1 m³ sur place</h3>
          <ul>
            <li><strong>Ciment</strong> : 250, 300 ou 350 kg selon le dosage, en sacs de {SAC_CIMENT_KG} kg arrondis au sac supérieur.</li>
            <li><strong>Sable 0/4</strong> : 0,4 m³, mesuré en vrac.</li>
            <li><strong>Gravillons 4/20</strong> : 0,8 m³, mesurés en vrac.</li>
            <li><strong>Eau</strong> : environ la moitié de la masse de ciment, soit 175 litres pour 350 kg.</li>
          </ul>
          <p>
            Ces proportions sont celles des guides de bricolage. Elles varient avec l&apos;humidité du sable, la granulométrie et le ciment : vérifiez la fiche du fabricant. Un béton courant pèse environ {fmt(MASSE_VOLUMIQUE_BETON, 1)} t par m³.
          </p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-pente", label: "Calculateur de pente" },
            { href: "/modele/devis-travaux", label: "Modèle de devis travaux" },
            { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis gratuit" },
            { href: "/guide/tva-travaux", label: "Guide : TVA des travaux" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Calculateur de béton : volume, ciment et dosage", "/outils/calculateur-beton", "Calcul du volume de béton d'une dalle, d'une semelle ou de poteaux, avec marge de perte, puis ciment, sable, gravillons et eau.")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
