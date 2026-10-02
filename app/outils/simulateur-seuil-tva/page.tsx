"use client"

import { useState, useMemo, useRef } from "react"
import { Calculator, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { OutilsCtaBar } from "@/components/outils/OutilsCtaBar"
import { Callout, Field, Gauge, JsonLd, Prose, RateTable, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolPanel, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { AmountInput, ChoiceGroup, ResetButton } from "@/components/outils/controls"

const SEUILS = [
  { id: "vente", label: "Vente de marchandises (BIC)", seuilBase: 91900, seuilMajore: 101000, plafond: 188700 },
  { id: "services", label: "Prestations de services (BIC/BNC)", seuilBase: 36800, seuilMajore: 39100, plafond: 77700 },
]

function fmtEur(n: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) }

const FAQ = [
  { q: "Quand dois-je commencer à facturer la TVA ?", a: "Dès le 1er jour du mois de dépassement du seuil majoré. Si vous dépassez le seuil de base 2 ans de suite, dès le 1er janvier de la 2e année." },
  { q: "Dois-je rembourser la TVA sur mes anciennes factures ?", a: "Non, les factures émises avant le dépassement restent sans TVA." },
  { q: "Puis-je récupérer la TVA sur mes achats ?", a: "Seulement une fois assujetti. En franchise, vous ne facturez ni ne récupérez la TVA." },
]

export default function SimulateurSeuilTvaPage() {
  const [activite, setActivite] = useState("services")
  const [ca, setCa] = useState("")
  const resultRef = useRef<HTMLDivElement>(null)

  const seuil = SEUILS.find((s) => s.id === activite)!
  const numCa = parseFloat(ca.replace(",", ".").replace(/\s/g, "")) || 0

  const status = useMemo(() => {
    if (numCa <= 0) return null
    if (numCa <= seuil.seuilBase) return { level: "ok" as const, label: "Franchise en base", icon: CheckCircle2, message: `Vous restez sous le seuil de ${fmtEur(seuil.seuilBase)}. Pas de TVA à facturer.` }
    if (numCa <= seuil.seuilMajore) return { level: "warn" as const, label: "Seuil majoré atteint", icon: AlertTriangle, message: `Vous dépassez le seuil de base (${fmtEur(seuil.seuilBase)}) mais restez sous le seuil majoré (${fmtEur(seuil.seuilMajore)}). Si vous dépassez 2 années consécutives, la TVA devient obligatoire.` }
    return { level: "danger" as const, label: "TVA obligatoire", icon: AlertTriangle, message: `Vous dépassez le seuil majoré de ${fmtEur(seuil.seuilMajore)}. Vous devez facturer la TVA dès le 1er jour du mois de dépassement.` }
  }, [numCa, seuil])

  const gaugePercent = numCa > 0 ? Math.min((numCa / seuil.seuilMajore) * 100, 120) : 0

  const handleCaChange = (v: string) => {
    setCa(v.replace(/[^0-9.,\s]/g, ""))
    setTimeout(() => { if (resultRef.current && parseFloat(v.replace(",", ".").replace(/\s/g, "")) > 0) resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }) }, 100)
  }

  return (
    <ToolShell ctaBar={<OutilsCtaBar text="La mention de franchise de TVA sur vos devis et factures." />}>
      <OutilsHero
        crumb="Simulateur seuil TVA"
        icon={<Calculator />}
        badge="Seuils 2026"
        title="Simulateur de seuil"
        accent="de franchise de TVA."
        subtitle="Vérifiez si votre chiffre d'affaires dépasse le seuil de franchise de TVA auto-entrepreneur. Seuils 2026."
      />

      <ToolArea>
        <ToolPanel>
          <Field label="Type d'activité">
            <ChoiceGroup
              label="Type d'activité"
              value={activite}
              onChange={setActivite}
              options={SEUILS.map((s) => ({ value: s.id, label: s.label, desc: `Seuil ${fmtEur(s.seuilBase)} · Majoré ${fmtEur(s.seuilMajore)}` }))}
            />
          </Field>

          <Field label="Chiffre d'affaires annuel" htmlFor="seuil-ca" className="mt-6">
            <AmountInput id="seuil-ca" value={ca} onChange={handleCaChange} placeholder="35 000" suffix="€/an" autoFocus />
          </Field>

          <div ref={resultRef}>
            {status && (
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-q-line bg-q-surface-2 p-5 sm:p-6" aria-live="polite">
                <Gauge
                  label="Position par rapport au seuil majoré"
                  value={`${Math.round(gaugePercent)} %`}
                  percent={Math.min(gaugePercent, 100)}
                  tone={gaugePercent > 100 ? "danger" : gaugePercent > 80 ? "warn" : "ok"}
                  marker={(seuil.seuilBase / seuil.seuilMajore) * 100}
                  scale={["0 €", fmtEur(seuil.seuilBase), fmtEur(seuil.seuilMajore)]}
                />
                <Callout tone={status.level} icon={status.icon} title={status.label}>
                  {status.message}
                </Callout>
                {status.level === "ok" && <p className="text-[13px] text-q-text-4">Ajoutez la mention « TVA non applicable, art. 293 B du CGI » sur vos factures.</p>}
                <div className="flex justify-end">
                  <ResetButton onClick={() => setCa("")} />
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
            La <strong>franchise en base de TVA</strong> dispense les auto-entrepreneurs de facturer la TVA tant que leur CA annuel reste sous certains seuils :
          </p>
          <RateTable head={["Activité", "Seuil base", "Seuil majoré"]} rows={SEUILS.map((s) => [s.label, fmtEur(s.seuilBase), fmtEur(s.seuilMajore)])} />
          <Callout tone="info" icon={Info}>
            Si vous dépassez le seuil de base mais restez sous le seuil majoré, la franchise est maintenue pour l&apos;année en cours. Si le dépassement se répète l&apos;année suivante, la TVA s&apos;applique dès le 1er janvier.
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
