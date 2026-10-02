"use client"

import { useState } from "react"
import { ArrowRight, ArrowLeft, FileText, Download, Loader2, RotateCcw, Info } from "lucide-react"
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
  { q: "Cette facture est-elle une facture électronique ?", a: "Non, c'est un PDF simple. Il convient tant que la facturation électronique ne vous est pas imposée : toute entreprise doit pouvoir en recevoir depuis le 1er septembre 2026, et les TPE et PME devront en émettre à partir du 1er septembre 2027, par une plateforme agréée." },
  { q: "Mes données sont-elles sauvegardées ?", a: "Non, aucune donnée n'est stockée. Le PDF est généré puis téléchargé." },
  { q: "Combien de factures puis-je générer ?", a: "Autant que vous voulez, gratuitement." },
]

export default function GenerateurFacturePage() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [emetteur, setEmetteur] = useState({ nom: "", adresse: "", siret: "", email: "" })
  const [client, setClient] = useState({ nom: "", adresse: "", siret: "" })
  const [numero, setNumero] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [echeance, setEcheance] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10) })
  const [lignes, setLignes] = useState<Ligne[]>([newLigne()])
  const [mentionTVA, setMentionTVA] = useState("")
  const [notes, setNotes] = useState("")

  const updateLigne = (id: string, field: keyof Ligne, value: string | number) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
  }
  const removeLigne = (id: string) => { setLignes((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev)) }

  const subtotalHT = lignes.reduce((s, l) => s + l.quantite * l.prixHT, 0)
  const totalTVA = lignes.reduce((s, l) => s + l.quantite * l.prixHT * (l.tauxTVA / 100), 0)
  const totalTTC = subtotalHT + totalTVA
  const totals = { ht: subtotalHT, tva: totalTVA, ttc: totalTTC }
  const canGenerate = emetteur.nom.trim() && client.nom.trim() && lignes.some((l) => l.description.trim() && l.prixHT > 0)

  const handleGenerate = async () => {
    if (!canGenerate) return
    setLoading(true)
    try {
      const res = await fetch("/api/outils/facture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emetteur, client, numero, date, echeance, lignes, mentionTVA, notes }),
      })
      if (!res.ok) throw new Error("Erreur")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `facture-${numero || "brouillon"}.pdf`; a.click()
      trackEvent("Schedule", { content_name: "Generateur facture PDF", content_category: "tools" })
      URL.revokeObjectURL(url)
    } catch { alert("Erreur lors de la génération. Veuillez réessayer.") }
    finally { setLoading(false) }
  }

  const handleReset = () => {
    setEmetteur({ nom: "", adresse: "", siret: "", email: "" }); setClient({ nom: "", adresse: "", siret: "" })
    setLignes([newLigne()]); setNumero(""); setMentionTVA(""); setNotes(""); setStep(0)
  }

  const paper = (
    <DocPaper
      kind="Facture"
      numero={numero}
      numeroPlaceholder="F-2026-001"
      date={date}
      dateLabel="Émise le"
      date2={echeance}
      date2Label="Échéance"
      emetteur={emetteur}
      client={client}
      lignes={lignes}
      totals={totals}
      mention={mentionTVA}
      notes={notes}
    />
  )

  return (
    <ToolShell>
      <OutilsHero
        crumb="Générateur de facture"
        icon={<FileText />}
        badge="PDF gratuit"
        title="Générateur de facture"
        accent="gratuit, en PDF."
        subtitle="Remplissez le formulaire et téléchargez votre facture en PDF. Gratuit, sans inscription, aucune donnée stockée."
      />

      <ToolArea width="lg">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="q-card overflow-hidden">
            <Stepper steps={STEPS} current={step} onSelect={setStep} />

            <div className="min-h-[320px] p-5 sm:p-7">
              {/* Étape 1 — Émetteur */}
              {step === 0 && (
                <div>
                  <PanelTitle>Vos informations</PanelTitle>
                  <div className="flex flex-col gap-4">
                    <Field label="Nom / Raison sociale *" htmlFor="f-em-nom">
                      <input id="f-em-nom" className="q-input" value={emetteur.nom} onChange={(e) => setEmetteur((p) => ({ ...p, nom: e.target.value }))} placeholder="Ma Société SAS" />
                    </Field>
                    <Field label="Adresse" htmlFor="f-em-adresse">
                      <input id="f-em-adresse" className="q-input" value={emetteur.adresse} onChange={(e) => setEmetteur((p) => ({ ...p, adresse: e.target.value }))} placeholder="12 rue de la Paix, 75001 Paris" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="SIRET" htmlFor="f-em-siret">
                        <input id="f-em-siret" className="q-input font-mono" value={emetteur.siret} onChange={(e) => setEmetteur((p) => ({ ...p, siret: e.target.value }))} placeholder="123 456 789 00012" />
                      </Field>
                      <Field label="Email" htmlFor="f-em-email">
                        <input id="f-em-email" className="q-input" type="email" value={emetteur.email} onChange={(e) => setEmetteur((p) => ({ ...p, email: e.target.value }))} placeholder="contact@email.fr" />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* Étape 2 — Client */}
              {step === 1 && (
                <div>
                  <PanelTitle>Informations client</PanelTitle>
                  <div className="flex flex-col gap-4">
                    <Field label="Nom / Raison sociale *" htmlFor="f-cl-nom">
                      <input id="f-cl-nom" className="q-input" value={client.nom} onChange={(e) => setClient((p) => ({ ...p, nom: e.target.value }))} placeholder="Client SARL" />
                    </Field>
                    <Field label="Adresse" htmlFor="f-cl-adresse">
                      <input id="f-cl-adresse" className="q-input" value={client.adresse} onChange={(e) => setClient((p) => ({ ...p, adresse: e.target.value }))} placeholder="5 avenue des Champs-Élysées, 75008 Paris" />
                    </Field>
                    <Field label="SIRET" htmlFor="f-cl-siret">
                      <input id="f-cl-siret" className="q-input font-mono" value={client.siret} onChange={(e) => setClient((p) => ({ ...p, siret: e.target.value }))} placeholder="987 654 321 00034" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="N° facture" htmlFor="f-numero">
                        <input id="f-numero" className="q-input font-mono" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="F-2026-001" />
                      </Field>
                      <Field label="Émission" htmlFor="f-date">
                        <input id="f-date" className="q-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                      </Field>
                      <Field label="Échéance" htmlFor="f-echeance">
                        <input id="f-echeance" className="q-input" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* Étape 3 — Lignes */}
              {step === 2 && (
                <div>
                  <PanelTitle>Lignes de facturation *</PanelTitle>
                  <LineItemsEditor
                    lignes={lignes}
                    onUpdate={updateLigne}
                    onRemove={removeLigne}
                    onAdd={() => setLignes((prev) => [...prev, newLigne()])}
                    rates={[20, 10, 5.5, 2.1, 0]}
                  />
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Mention TVA" htmlFor="f-mention">
                      <input id="f-mention" className="q-input" value={mentionTVA} onChange={(e) => setMentionTVA(e.target.value)} placeholder="TVA non applicable, art. 293 B" />
                    </Field>
                    <Field label="Notes" htmlFor="f-notes">
                      <input id="f-notes" className="q-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Merci pour votre confiance" />
                    </Field>
                  </div>
                </div>
              )}

              {/* Étape 4 — Aperçu */}
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

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!canGenerate || loading}
                    className="lp-btn-p mt-5 w-full"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
                    Télécharger le PDF
                  </button>
                </div>
              )}
            </div>

            {/* Navigation entre les étapes */}
            <div className="flex items-center justify-between gap-3 border-t border-q-line-soft px-5 py-4 sm:px-7">
              <button type="button" onClick={() => (step > 0 ? setStep(step - 1) : handleReset())} className="q-btn q-btn-ghost">
                {step > 0 ? <><ArrowLeft aria-hidden /> Précédent</> : <><RotateCcw aria-hidden /> Réinitialiser</>}
              </button>
              {step < 3 && (
                <button type="button" onClick={() => setStep(step + 1)} className="q-btn q-btn-primary q-btn-lg sm:!h-10 sm:!rounded-[10px] sm:!text-[14px]">
                  Suivant <ArrowRight aria-hidden />
                </button>
              )}
            </div>
          </div>

          {/* Aperçu en direct (grand écran) */}
          <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label="Aperçu en direct">
            <p className="mb-2 text-[13px] font-semibold text-q-text-3">Aperçu en direct</p>
            {paper}
          </aside>
        </div>

        <ToolCta
          title="Ce PDF n'est pas une facture électronique"
          text="Avec Qonforme, vos factures PDF partent avec leurs données Factur-X, se créent en un clic depuis un devis accepté et sont numérotées à la suite. La transmission par plateforme agréée est en préparation."
          cta="Créer mon compte"
        />
      </ToolArea>

      <ToolGuide title="Créer une facture" accent="conforme en France.">
        <Prose>
          <p>Une facture doit contenir des <strong>mentions obligatoires</strong> :</p>
          <ul>
            <li><strong>Identité émetteur</strong> : nom, SIRET, adresse, TVA</li>
            <li><strong>Identité client</strong> : nom, adresse</li>
            <li><strong>Numéro</strong> : unique, chronologique</li>
            <li><strong>Dates</strong> : émission et échéance</li>
            <li><strong>Montants</strong> : HT, TVA, TTC</li>
            <li><strong>Conditions de paiement</strong> : pénalités de retard et indemnité de 40 €</li>
          </ul>
          <h3>2026-2027 : ce qui change</h3>
          <p>
            Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques. À partir du 1er septembre 2027, les TPE et PME doivent aussi émettre leurs factures entre entreprises en électronique (Factur-X, UBL ou CII), par une plateforme agréée. Ce générateur produit un PDF simple, pas une facture électronique.
          </p>
        </Prose>

        <ToolFaq items={FAQ} />

        <ToolLinks
          links={[
            { href: "/outils/calculateur-tva", label: "Calculateur TVA HT/TTC" },
            { href: "/outils/generateur-devis-gratuit", label: "Générateur de devis gratuit" },
            { href: "/outils/verificateur-mentions-facture", label: "Vérificateur mentions facture" },
            { href: "/outils/verification-siret", label: "Vérificateur SIREN/SIRET" },
          ]}
        />
      </ToolGuide>

      <JsonLd data={toolJsonLd("Générateur de facture gratuit en ligne", "/outils/generateur-facture-gratuite")} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </ToolShell>
  )
}
