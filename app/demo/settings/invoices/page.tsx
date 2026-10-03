import type { Metadata } from "next"
import { InvoiceSettingsForm } from "@/components/settings/InvoiceSettingsForm"
import { SettingsFrame } from "@/components/settings/SettingsFrame"
import { DEMO_COMPANY, DEMO_INVOICES, DEMO_QUOTES } from "@/lib/demo/data"
import { DEMO_LEGAL_NOTICE, DEMO_LEGAL_PROFILE } from "@/lib/demo/legal-profile"

export const metadata: Metadata = { title: "Modèles de documents — Démo" }

/** Démo de Paramètres › Modèles de documents : même formulaire que l'application, rien n'est enregistré. */
export default function DemoInvoiceSettingsPage() {
  return (
    <SettingsFrame mode="demo">
      <InvoiceSettingsForm
        mode="demo"
        demo={{
          company: {
            name: DEMO_COMPANY.name,
            address: DEMO_COMPANY.address,
            zip_code: DEMO_COMPANY.zip_code,
            city: DEMO_COMPANY.city,
            siren: DEMO_COMPANY.siren,
            siret: "",
            vat_number: DEMO_COMPANY.vat_number,
            iban: DEMO_COMPANY.iban,
          },
          legalProfile: DEMO_LEGAL_PROFILE,
          settings: {
            accent_color: "#2563EB",
            invoice_prefix: DEMO_COMPANY.invoice_prefix,
            legal_notice: DEMO_LEGAL_NOTICE,
            payment_terms: "Paiement par virement bancaire sous 30 jours.",
          },
          logo_url: null,
          invoiceNumbers: DEMO_INVOICES.flatMap((i) => (i.invoice_number ? [i.invoice_number] : [])),
          quoteNumbers: DEMO_QUOTES.map((q) => q.quote_number),
        }}
      />
    </SettingsFrame>
  )
}
