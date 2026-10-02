'use client'

/**
 * Miroir démo de NewInvoiceForm : même éditeur (components/documents), données
 * de lib/demo/data.ts, aucune écriture. Les actions expliquent qu'il faut un
 * compte et mènent à l'inscription.
 */
import { useState } from "react"
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { PersonalizeTip } from "@/components/documents/PersonalizeTip"
import { DemoNotice, demoAction, DEMO_DOC_CLIENTS, DEMO_DOC_COMPANY, DEMO_DOC_PRODUCTS, demoLines } from "@/components/documents/demo"
import { useDocumentForm } from "@/components/documents/useDocumentForm"
import { isoDateIn } from "@/components/documents/model"

export default function DemoInvoiceForm() {
  const [tipDismissed, setTipDismissed] = useState(false)

  // Brouillon d'exemple (Atelier Morel, comme le canevas Mobile-creation) ;
  // dates calculées au montage, jamais au chargement du module
  const doc = useDocumentForm("invoice", () => ({
    client_id: "morel", issue_date: isoDateIn(0), due_date: isoDateIn(30), valid_until: "",
    delivery_date: "", reference: "",
    notes: "Paiement par virement à 30 jours.\nPénalités de retard : 3 fois le taux d'intérêt légal.\nIndemnité forfaitaire pour frais de recouvrement : 40 €.",
    lines: demoLines([["lissage", 24], ["bandes", 24], ["deplacement", 1]]),
  }))

  // Mêmes contrôles que le vrai formulaire avant d'expliquer la démo
  const act = (validate: boolean, what: string) => () => demoAction(doc, validate, what)

  return (
    <DocumentEditor
      kind="invoice"
      doc={doc}
      title="Nouvelle facture"
      status="nouveau brouillon · non enregistré"
      backHref="/demo/invoices"
      backLabel="Factures"
      clients={DEMO_DOC_CLIENTS}
      clientsLoading={false}
      newClientHref="/demo/clients/new"
      company={DEMO_DOC_COMPANY}
      catalog={{ products: DEMO_DOC_PRODUCTS, manageHref: "/demo/products" }}
      banners={
        <>
          <DemoNotice />
          {!tipDismissed && (
            <PersonalizeTip
              href="/signup"
              cta="Créer mon compte"
              text="Créez votre compte pour ajouter votre logo et votre identité visuelle."
              onDismiss={() => setTipDismissed(true)}
            />
          )}
        </>
      }
      actions={{
        onSaveDraft:  act(false, "enregistrer vos brouillons"),
        onSend:       act(true, "envoyer vos factures"),
        onPreviewPdf: act(true, "générer l'aperçu PDF"),
        saving: false,
        sending: false,
        previewing: false,
      }}
    />
  )
}
