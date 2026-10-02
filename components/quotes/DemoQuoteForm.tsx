'use client'

/**
 * Miroir démo de NewQuoteForm : même éditeur (components/documents), données
 * de lib/demo/data.ts, aucune écriture. Les actions mènent à l'inscription.
 */
import { DocumentEditor } from "@/components/documents/DocumentEditor"
import { DemoNotice, demoAction, DEMO_DOC_CLIENTS, DEMO_DOC_COMPANY, DEMO_DOC_PRODUCTS, demoLines } from "@/components/documents/demo"
import { useDocumentForm } from "@/components/documents/useDocumentForm"
import { isoDateIn } from "@/components/documents/model"

export default function DemoQuoteForm() {
  // Devis d'exemple (cloisons et doublage chez une particulière, comme le
  // canevas Nouveau-devis) ; dates calculées au montage
  const doc = useDocumentForm("quote", () => ({
    client_id: "fontaine", issue_date: isoDateIn(0), due_date: "", valid_until: isoDateIn(30),
    delivery_date: "", reference: "",
    notes: "Devis valable 30 jours.\nAcompte de 30 % à la commande, solde à la fin des travaux.",
    lines: demoLines([["cloison", 12], ["doublage", 18], ["bandes", 30], ["deplacement", 1]]),
  }))

  return (
    <DocumentEditor
      kind="quote"
      doc={doc}
      title="Nouveau devis"
      status="nouveau brouillon · non enregistré"
      backHref="/demo/quotes"
      backLabel="Devis"
      clients={DEMO_DOC_CLIENTS}
      clientsLoading={false}
      newClientHref="/demo/clients/new"
      company={DEMO_DOC_COMPANY}
      catalog={{ products: DEMO_DOC_PRODUCTS, manageHref: "/demo/products" }}
      banners={<DemoNotice />}
      actions={{
        onSaveDraft: () => demoAction(doc, false, "enregistrer vos brouillons"),
        onSend:      () => demoAction(doc, true, "envoyer vos devis"),
        saving: false,
        sending: false,
      }}
    />
  )
}
