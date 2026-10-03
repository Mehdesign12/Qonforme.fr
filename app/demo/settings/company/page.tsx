import type { Metadata } from "next"
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm"
import { SettingsFrame } from "@/components/settings/SettingsFrame"
import { DEMO_COMPANY } from "@/lib/demo/data"
import { DEMO_BANK } from "@/lib/demo/payment-link"
import { DEMO_LEGAL_NOTICE, DEMO_LEGAL_PROFILE } from "@/lib/demo/legal-profile"

export const metadata: Metadata = { title: "Entreprise — Démo Qonforme" }

/** Démo de Paramètres › Entreprise : même formulaire que l'application, rien n'est enregistré. */
export default function DemoCompanySettingsPage() {
  return (
    <SettingsFrame mode="demo">
      <CompanySettingsForm
        mode="demo"
        initial={{
          name: DEMO_COMPANY.name,
          siren: DEMO_COMPANY.siren,
          siret: `${DEMO_COMPANY.siren}00027`,
          vat_number: DEMO_COMPANY.vat_number,
          address: DEMO_COMPANY.address,
          zip_code: DEMO_COMPANY.zip_code,
          city: DEMO_COMPANY.city,
          iban: DEMO_COMPANY.iban,
          account_holder: DEMO_BANK.holder,
          bic: DEMO_BANK.bic,
          email: DEMO_COMPANY.email,
          logo_url: null,
          legal_profile: DEMO_LEGAL_PROFILE,
          legal_notice: DEMO_LEGAL_NOTICE,
        }}
      />
    </SettingsFrame>
  )
}
