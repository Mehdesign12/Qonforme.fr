"use client"

import { useState } from "react"
import { ArrowRight, ArrowLeft, ClipboardList, Download, Loader2, Info } from "lucide-react"
import { trackEvent } from "@/lib/meta-pixel"
import { OutilsHero } from "@/components/outils/OutilsHero"
import { Callout, Field, JsonLd, PanelTitle, Prose, ToolArea, ToolCta, ToolFaq, ToolGuide, ToolLinks, ToolShell, faqJsonLd, toolJsonLd } from "@/components/outils/kit"
import { DocPaper, LineItemsEditor, PartySummary, Stepper, TotalsBox, newLigne, type Ligne } from "@/components/outils/doc-generator"

const STEPS = [
  { label: "Émetteur" },
  { label: "Client" },
  { label: "Lignes" },
  { label: "Aperçu" },
]

const FAQ = [
  { q: "Un devis est-il obligatoire ?", a: "Oui dans certains secteurs (BTP > 150 €, dépannage, déménagement). Dans les autres cas, il est fortement recommandé." },
  { q: "Quelle est la durée de validité d'un devis ?", a: "Il n'y a pas de durée légale. En pratique, 30 jours est le standard. Précisez-la toujours sur le devis." },
  { q: "Un devis signé engage-t-il le client ?", a: "Oui, un devis signé avec la mention « Bon pour accord » a valeur de contrat." },
]

export default function GenerateurDevisPage() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [emetteur, setEmetteur] = useState({ nom: "", adresse: "", siret: "", email: "" })
  const [client, setClient] = useState({ nom: "", adresse: "" })
  const [numero, setNumero] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [validite, setValidite] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) })
  const [lignes, setLignes] = useState<Ligne[]>([newLigne()])
  const [notes, setNotes] = useState("")

  const updateLigne = (id: string, field: keyof Ligne, value: string | number) => { setLignes((p) => p.map((l) => (l.id === id ? { ...l, [field]: value } : l))) }
  const removeLigne = (id: string) => { setLignes((p) => (p.length > 1 ? p.filter((l) => l.id !== id) : p)) }

  const subtotalHT = lignes.reduce((s, l) => s + l.quantite * l.prixHT, 0)
  const totalTVA = lignes.reduce((s, l) => s + l.quantite * l.prixHT * (l.tauxTVA / 100), 0)
  const totalTTC = subtotalHT + totalTVA
  const totals = { ht: subtotalHT, tva: totalTVA, ttc: totalTTC }
  const canGenerate = emetteur.nom.trim() && client.nom.trim() && lignes.some((l) => l.description.trim() && l.prixHT > 0)

  const handleGenerate = async () => {
    if (!canGenerate) return
    setLoading(true)
    try {
      const res = await fetch("/api/outils/devis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emetteur, client, numero, date, validite, lignes, notes }) })
      if (!res.ok) throw new Error("Erreur")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `devis-${numero || "brouillon"}.pdf`; a.click()
      trackEvent("Schedule", { content_name: "Generateur devis PDF", content_category: "tools" })
      URL.revokeObjectURL(url)
    } catch { alert("Erreur lors de la génération.") } finally { setLoading(false) }
  }

  const paper = (
    <DocPaper
      kind="Devis"
      numero={numero}
      numeroPlaceholder="D-2026-001"
      date={date}
      dateLabel="Établi le"
      date2={validite}
      date2Label="Valable jusqu'au"
      emetteur={emetteur}
      client={client}
      lignes={lignes}
      totals={totals}
      notes={notes}
    />
  )

  return (
    <ToolShell>
      <OutilsHero
        crumb="Générateur de devis"
        icon={<ClipboardList />}
        badge="PDF gratuit"
        title="Générateur de devis"
        accent="gratuit, en PDF."
        subtitle="Créez un devis professionnel en PDF. Remplissez, téléchargez. Gratuit, sans inscription."
      />

      <ToolArea width="lg">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="q-card overflow-hidden">
            <Stepper steps={STEPS} current={step} onSelect={setStep} />

            <div className="min-h-[320px] p-5 sm:p-7">
              {step === 0 && (
                <div>
                  <PanelTitle>Vos informations</PanelTitle>
                  <div className="flex flex-col gap-4">
                    <Field label="Nom / Raison sociale *" htmlFor="d-em-nom">
                      <input id="d-em-nom" className="q-input" value={emetteur.nom} onChange={(e) => setEmetteur((p) => ({ ...p, nom: e.target.value }))} placeholder="Ma Société SAS" />
                    </Field>
                    <Field label="Adresse" htmlFor="d-em-adresse">
                      <input id="d-em-adresse" className="q-input" value={emetteur.adresse} onChange={(e) => setEmetteur((p) => ({ ...p, adresse: e.target.value }))} placeholder="12 rue de la Paix, 75001 Paris" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="SIRET" htmlFor="d-em-siret">
                        <input id="d-em-siret" className="q-input font-mono" value={emetteur.siret} onChange={(e) => setEmetteur((p) => ({ ...p, siret: e.target.value }))} placeholder="123 456 789 00012" />
                      </Field>
                      <Field label="Email" htmlFor="d-em-email">
                        <input id="d-em-email" className="q-input" type="email" value={emetteur.email} onChange={(e) => setEmetteur((p) => ({ ...p, email: e.target.value }))} placeholder="contact@email.fr" />
                      </Field>
                    </div>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div>
                  <PanelTitle>Informations client</PanelTitle>
                  <div className="flex flex-col gap-4">
                    <Field label="Nom / Raison sociale *" htmlFor="d-cl-nom">
                      <input id="d-cl-nom" className="q-input" value={client.nom} onChange={(e) => setClient((p) => ({ ...p, nom: e.target.value }))} placeholder="Client SARL" />
                    </Field>
                    <Field label="Adresse" htmlFor="d-cl-adresse">
                      <input id="d-cl-adresse" className="q-input" value={client.adresse} onChange={(e) => setClient((p) => ({ ...p, adresse: e.target.value }))} placeholder="5 avenue des Champs-Élysées" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="N° devis" htmlFor="d-numero">
                        <input id="d-numero" className="q-input font-mono" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="D-2026-001" />
                      </Field>
                      <Field label="Date" htmlFor="d-date">
                        <input id="d-date" className="q-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                      </Field>
                      <Field label="Validité" htmlFor="d-validite">
                        <input id="d-validite" className="q-input" type="date" value={validite} onChange={(e) => setValidite(e.target.value)} />
                      </Field>
                    </div>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <PanelTitle>Lignes du devis *</PanelTitle>
                  <LineItemsEditor
                    lignes={lignes}
                    onUpdate={updateLigne}
                    onRemove={removeLigne}
                    onAdd={() => setLignes((p) => [...p, newLigne()])}
                    rates={[20, 10, 5.5, 0]}
                  />
                  <Field label="Notes" htmlFor="d-notes" className="mt-5">
                    <input id="d-notes" className="q-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions particulières..." />
                  </Field>
                </div>
              )}
              {step === 3 && (
                <div>
                  <PanelTitle>Récapitulatif</PanelTitle>
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PartySummary label="Émetteur" party={emetteur} />
                      <PartySummary label="Client" party={client} />
                    </div>
                    {/* Aperçu papier : sur mobile ici, sur grand écran dans la colonne de droite */}
                    <div className="lg:hidden">{paper}</div>
                    <TotalsBox totals={totals} />
                    {!canGenerate && (
                      <Callout tone="neutral" icon={Info}>
                        Renseignez votre nom, celui du client et au moins une ligne avec un prix pour télécharger le PDF.
                      </Callout>
                    )}
                  </div>
                  <button type="button" onClick={handleGenerate} disabled={!canGenerate || loading} className="lp-btn-p mt-5 w-full">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />} Télécharger le PDF
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-q-line-soft px-5 py-4 sm:px-7">
              <button type="button" onClick={() => (step > 0 ? setStep(step - 1) : undefined)} disabled={step === 0} className="q-btn q-btn-ghost">
                <ArrowLeft aria-hidden /> Précédent
              </button>
              {step < 3 && (
                <button type="button" onClick={() => setStep(step + 1)} className="q-btn q-btn-primary q-btn-lg sm:!h-10 sm:!rounded-[10px] sm:!text-[14px]">
                  Suivant <ArrowRight aria-hidden />
                </button>
              )}
            </div>
          </div>

          <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label="Aperçu en direct">
            <p className="mb-2 text-[13px] font-semibold text-q-text-3">Aperçu en direct</p>
            {paper}
          </aside>
        </div>

        <ToolCta
          title="Un devis accepté devient une facture en un clic"
          text="Dans Qonforme, les devis sont gratuits et illimités, s'envoient par email avec leur PDF, et un devis accepté se convertit en facture sans tout ressaisir."
        />
      </ToolArea>

      <ToolGuide title="Comment créer" accent="un devis conforme ?">
        <Prose>
          <p>
            Un devis doit contenir : l&apos;identité de l&apos;émetteur et du client, la date, un numéro unique, la description détaillée des prestations, les prix unitaires HT, le montant total HT et TTC, la durée de validité, et les conditions de paiement.
          </p>
          <p>Un devis signé par le client a <strong>valeur contractuelle</strong> et engage les deux parties.</p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/generateur-facture-gratuite", label: "Générateur de facture gratuit" },
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Générateur de devis gratuit en ligne", "/outils/generateur-devis-gratuit")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
