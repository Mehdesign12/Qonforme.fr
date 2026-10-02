'use client'

/**
 * Miroir démo de PurchaseOrderForm : même éditeur, données de lib/demo/data.ts,
 * aucune écriture. Les actions mènent à l'inscription.
 */
import { DocumentEditor } from "./DocumentEditor"
import { DemoNotice, demoAction, DEMO_DOC_CLIENTS, DEMO_DOC_COMPANY, DEMO_DOC_PRODUCTS, demoLines } from "./demo"
import { useDocumentForm } from "./useDocumentForm"
import { isoDateIn } from "./model"

export default function DemoPurchaseOrderForm() {
  // Bon de commande d'exemple (le bon reste facultatif : un client qui en demande un)
  const doc = useDocumentForm("purchase_order", () => ({
    client_id: "arvel", issue_date: isoDateIn(0), due_date: "", valid_until: "", delivery_date: isoDateIn(30),
    reference: "CMD-ARV-2026-118",
    notes: "Livraison sur chantier, ZA de la Bergerie à Cholet.",
    lines: demoLines([["cloison", 40], ["bandes", 40], ["benne", 1]]),
  }))

  return (
    <DocumentEditor
      kind="purchase_order"
      doc={doc}
      title="Nouveau bon de commande"
      status="nouveau brouillon · non enregistré"
      backHref="/demo/purchase-orders"
      backLabel="Bons de commande"
      clients={DEMO_DOC_CLIENTS}
      clientsLoading={false}
      newClientHref="/demo/clients/new"
      company={DEMO_DOC_COMPANY}
      catalog={{ products: DEMO_DOC_PRODUCTS, manageHref: "/demo/products" }}
      banners={<DemoNotice />}
      actions={{
        onSaveDraft: () => demoAction(doc, false, "enregistrer vos brouillons"),
        onSend:      () => demoAction(doc, true, "envoyer vos bons de commande"),
        saving: false,
        sending: false,
        sendLabel: "Créer et envoyer",
      }}
    />
  )
}
