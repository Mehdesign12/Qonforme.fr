"use client"

import { useMemo, useRef, useState } from "react"
import { Calculator, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Gauge, JsonLd, Prose, RateTable, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, ChoiceGroup, ResetButton, Seg } from "@/components/outils/controls"
import { SEUILS_FRANCHISE_TVA as SEUILS, analyserFranchise, joursActiviteDepuis, type ActiviteFranchise } from "@/lib/outils/franchise-tva"
import { filtrerSaisieMontant, parseMontant } from "@/lib/outils/montant"
import { dateValide } from "@/lib/outils/document"

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) }

const FAQ = [
  { q: "Quand dois-je commencer à facturer la TVA ?", a: "Dès que votre chiffre d'affaires de l'année dépasse le seuil majoré (93 500 € pour la vente, 41 250 € pour les services) : la TVA s'applique aux opérations réalisées à partir de la date du dépassement. Si vous dépassez seulement le seuil de base, la franchise continue jusqu'au 31 décembre et la TVA s'applique au 1er janvier suivant (art. 293 B du CGI)." },
  { q: "Mon chiffre d'affaires de l'an dernier compte-t-il ?", a: "Oui. Pour être en franchise une année, le chiffre d'affaires de l'année précédente ne doit pas dépasser le seuil de base (85 000 € pour la vente, 37 500 € pour les services). S'il l'a dépassé, la TVA s'applique dès le 1er janvier." },
  { q: "J'ai créé mon entreprise en cours d'année : quels seuils ?", a: "L'année de création, les seuils sont réduits au prorata des jours d'activité sur 365 (BOFiP, BOI-TVA-DECLA-40-10-10, § 290). Par exemple, pour un début le 12 juin, le seuil majoré des services est de 22 942 €." },
  { q: "Dois-je rembourser la TVA sur mes anciennes factures ?", a: "Non, les opérations réalisées avant le dépassement restent en franchise." },
  { q: "Puis-je récupérer la TVA sur mes achats ?", a: "Seulement une fois assujetti. En franchise, vous ne facturez ni ne récupérez la TVA." },
]

type Debut = "avant" | "an-dernier" | "cette-annee"

export default function SimulateurSeuilTvaPage() {
  const annee = new Date().getFullYear()
  const [activite, setActivite] = useState<ActiviteFranchise>("services")
  const [debut, setDebut] = useState<Debut>("avant")
  const [dateDebut, setDateDebut] = useState("")
  const [caPrec, setCaPrec] = useState("")
  const [ca, setCa] = useState("")
  const resultRef = useRef<HTMLDivElement>(null)

  const seuil = SEUILS.find((s) => s.id === activite)!
  const numCa = parseMontant(ca)
  const numCaPrec = parseMontant(caPrec)
  const anneeDebutAttendue = debut === "an-dernier" ? annee - 1 : annee
  const dateDebutOk = debut === "avant" || (dateValide(dateDebut) && Number(dateDebut.slice(0, 4)) === anneeDebutAttendue)

  const erreurMontant = (saisie: string, n: number | null) => (saisie.trim() === "" ? "" : n === null ? "Montant invalide : saisissez par exemple 35 000." : n < 0 ? "Le montant doit être positif." : "")
  const erreurCa = erreurMontant(ca, numCa)
  const erreurCaPrec = debut === "cette-annee" ? "" : erreurMontant(caPrec, numCaPrec)

  const analyse = useMemo(() => {
    if (erreurCa || erreurCaPrec || numCa === null || numCa < 0 || !dateDebutOk) return null
    return analyserFranchise({
      activite,
      caAnnee: numCa,
      // Année précédente non renseignée : seule l'année en cours est analysée
      caAnneePrecedente: debut === "cette-annee" ? null : numCaPrec,
      joursAnneePrecedente: debut === "an-dernier" ? joursActiviteDepuis(dateDebut) : undefined,
      joursAnneeCreation: debut === "cette-annee" ? joursActiviteDepuis(dateDebut) : undefined,
    })
  }, [activite, debut, dateDebut, dateDebutOk, numCa, numCaPrec, erreurCa, erreurCaPrec])

  const status = useMemo(() => {
    if (!analyse) return null
    const ajuste = debut === "cette-annee" ? " (ajusté à vos jours d'activité)" : ""
    switch (analyse.situation) {
      case "tva-des-le-1er-janvier":
        return { level: "danger" as const, label: `TVA depuis le 1er janvier ${annee}`, icon: AlertTriangle, message: `Votre chiffre d'affaires ${annee - 1} dépasse le seuil de base de ${fmtEur(analyse.seuilBaseAnneePrecedente!)}${debut === "an-dernier" ? " (ajusté à vos jours d'activité de l'an dernier)" : ""}. La franchise ne s'applique pas en ${annee} : vous facturez la TVA sur toutes vos opérations depuis le 1er janvier.` }
      case "tva-des-le-depassement":
        return { level: "danger" as const, label: "TVA obligatoire", icon: AlertTriangle, message: `Vous dépassez le seuil majoré de ${fmtEur(analyse.seuilMajore)}${ajuste}. La franchise cesse à la date du dépassement : la TVA s'applique aux opérations réalisées à partir de ce jour.` }
      case "fin-au-31-decembre":
        return { level: "warn" as const, label: "Seuil de base dépassé", icon: AlertTriangle, message: `Vous dépassez le seuil de base (${fmtEur(analyse.seuilBase)}${ajuste}) sans dépasser le seuil majoré (${fmtEur(analyse.seuilMajore)}). La franchise continue jusqu'au 31 décembre ; la TVA s'appliquera au 1er janvier ${annee + 1}.` }
      default:
        return { level: "ok" as const, label: "Franchise en base", icon: CheckCircle2, message: `Vous restez sous le seuil de base de ${fmtEur(analyse.seuilBase)}${ajuste}. Pas de TVA à facturer.` }
    }
  }, [analyse, annee, debut])

  // Vraie position par rapport au seuil majoré, même au-delà de 100 %
  const gaugePercent = analyse && numCa ? (numCa / analyse.seuilMajore) * 100 : 0
  // Arrondi à l'entier, sans afficher 100 % pour un seuil franchi de peu (ni atteint de peu)
  const arrondi = Math.round(gaugePercent)
  const pourcentAffiche = gaugePercent > 100 && arrondi <= 100 ? 101 : gaugePercent < 100 && arrondi >= 100 ? 99 : arrondi

  const handleCaChange = (v: string) => {
    setCa(filtrerSaisieMontant(v))
    setTimeout(() => { if (resultRef.current && (parseMontant(v) ?? 0) > 0) resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, 100)
  }

  const reset = () => { setCa(""); setCaPrec(""); setDateDebut(""); setDebut("avant") }

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="La mention de franchise de TVA sur vos devis et factures." />}>
      <OutilsHero
        crumb="Simulateur seuil TVA"
        icon={<Calculator />}
        badge="Seuils 2026"
        title="Simulateur de seuil"
        accent="de franchise de TVA."
        subtitle="Vérifiez si votre chiffre d'affaires, de cette année et de l'an dernier, vous laisse en franchise de TVA. Seuils 2026."
      />

      <ToolArea>
        <ToolPanel>
          <Field label="Type d'activité">
            <ChoiceGroup
              label="Type d'activité"
              value={activite}
              onChange={(v) => setActivite(v as ActiviteFranchise)}
              options={SEUILS.map((s) => ({ value: s.id, label: s.label, desc: `Seuil ${fmtEur(s.seuilBase)} · Majoré ${fmtEur(s.seuilMajore)}` }))}
            />
          </Field>

          <Field label="Début de votre activité" className="mt-6">
            <Seg
              label="Début de votre activité"
              value={debut}
              onChange={setDebut}
              options={[
                { value: "avant", label: `Avant ${annee - 1}` },
                { value: "an-dernier", label: `En ${annee - 1}` },
                { value: "cette-annee", label: `En ${annee}` },
              ]}
            />
          </Field>

          {debut !== "avant" && (
            <Field
              label="Date de début d'activité"
              htmlFor="seuil-debut"
              className="mt-4"
              hint="L'année de création, les seuils sont réduits au prorata des jours d'activité sur 365."
            >
              <input
                id="seuil-debut"
                type="date"
                className="q-input sm:max-w-[240px]"
                min={`${anneeDebutAttendue}-01-01`}
                max={`${anneeDebutAttendue}-12-31`}
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                aria-invalid={dateDebut && !dateDebutOk ? true : undefined}
              />
              {dateDebut && !dateDebutOk && <p className="q-field-error">Choisissez une date de {anneeDebutAttendue}.</p>}
            </Field>
          )}

          {debut !== "cette-annee" && (
            <Field label={`Chiffre d'affaires ${annee - 1}`} htmlFor="seuil-ca-prec" className="mt-6" hint={erreurCaPrec ? undefined : `Encaissé du 1er janvier au 31 décembre ${annee - 1}.`}>
              <AmountInput id="seuil-ca-prec" value={caPrec} onChange={(v) => setCaPrec(filtrerSaisieMontant(v))} placeholder="30 000" suffix="€" invalid={!!erreurCaPrec} ariaDescribedBy={erreurCaPrec ? "seuil-ca-prec-err" : undefined} />
              {erreurCaPrec && <p id="seuil-ca-prec-err" className="q-field-error">{erreurCaPrec}</p>}
            </Field>
          )}

          <Field label={`Chiffre d'affaires ${annee}`} htmlFor="seuil-ca" className="mt-6" hint={erreurCa ? undefined : "Depuis le 1er janvier, ou ce que vous prévoyez pour l'année."}>
            <AmountInput id="seuil-ca" value={ca} onChange={handleCaChange} placeholder="35 000" suffix="€" invalid={!!erreurCa} ariaDescribedBy={erreurCa ? "seuil-ca-err" : undefined} />
            {erreurCa && <p id="seuil-ca-err" className="q-field-error">{erreurCa}</p>}
          </Field>

          <div ref={resultRef}>
            {status && analyse && (
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-q-line bg-q-surface-2 p-5 sm:p-6" aria-live="polite">
                <Gauge
                  label={`Chiffre d'affaires ${annee} par rapport au seuil majoré`}
                  value={`${pourcentAffiche.toLocaleString("fr-FR")}\u00a0%`}
                  percent={gaugePercent}
                  tone={gaugePercent > 100 ? "danger" : (numCa ?? 0) > analyse.seuilBase ? "warn" : "ok"}
                  marker={(analyse.seuilBase / analyse.seuilMajore) * 100}
                  scale={["0 €", fmtEur(analyse.seuilBase), fmtEur(analyse.seuilMajore)]}
                />
                <Callout tone={status.level} icon={status.icon} title={status.label}>
                  {status.message}
                </Callout>
                {debut !== "cette-annee" && numCaPrec === null && (
                  <p className="text-[13px] text-q-text-3">
                    Indiquez aussi votre chiffre d&apos;affaires {annee - 1} : s&apos;il dépasse {fmtEur(seuil.seuilBase)}, la TVA s&apos;applique depuis le 1er janvier {annee}.
                  </p>
                )}
                {status.level === "ok" && <p className="text-[13px] text-q-text-4">Ajoutez la mention « TVA non applicable, art. 293 B du CGI » sur vos factures.</p>}
                <div className="flex justify-end">
                  <ResetButton onClick={reset} />
                </div>
              </div>
            )}
          </div>
        </ToolPanel>

        <ToolCta
          className="hidden sm:flex"
          title="Vos mentions sur chaque document"
          text="Dans Qonforme, la mention de franchise (« TVA non applicable, art. 293 B du CGI ») s'enregistre une fois dans vos réglages et s'imprime ensuite en pied de chaque facture."
        />
      </ToolArea>

      <ToolGuide title="Seuils de franchise" accent="de TVA en 2026.">
        <Prose>
          <p>
            La <strong>franchise en base de TVA</strong> (article 293 B du CGI) dispense de facturer la TVA tant que le chiffre d&apos;affaires reste sous deux seuils : le seuil de base, apprécié sur l&apos;année précédente, et le seuil majoré, sur l&apos;année en cours.
          </p>
          <RateTable head={["Activité", "Seuil de base", "Seuil majoré"]} rows={SEUILS.map((s) => [s.label, fmtEur(s.seuilBase), fmtEur(s.seuilMajore)])} />
          <Callout tone="info" icon={Info}>
            Chiffre d&apos;affaires de l&apos;an dernier au-dessus du seuil de base : TVA dès le 1er janvier. Seuil de base dépassé cette année sans dépasser le seuil majoré : la franchise continue jusqu&apos;au 31 décembre. Depuis le 1er mars 2025, la franchise n&apos;est plus conservée une seconde année.
          </Callout>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/simulateur-charges-auto-entrepreneur", label: "Simulateur charges" },
            { href: "/outils/simulateur-revenu-net", label: "Simulateur revenus net" },
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Simulateur seuil TVA auto-entrepreneur", "/outils/simulateur-seuil-tva")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
