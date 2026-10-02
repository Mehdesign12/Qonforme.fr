import type { Metadata } from "next"
import CompanyForm from "@/components/auth/CompanyForm"
import AuthLayout from "@/components/auth/AuthLayout"
import { Serif } from "@/components/auth/AuthHeading"

export const metadata: Metadata = { title: "Votre entreprise — Qonforme" }
export const dynamic = "force-dynamic"

// Deux étapes réelles : pas d'étape « Prestations » ni « Premier pas » dans le code.
const STEPS = [
  { label: "Compte" },
  { label: "Entreprise" },
]

export default function SignupCompanyPage() {
  return (
    <AuthLayout maxWidth="2xl" bar={{ steps: STEPS, current: 1 }}>
      <div>
        <h1 className="q-display m-0 text-[28px] leading-[1.1] tracking-[-0.03em] text-q-ink-strong md:text-[38px]">
          Votre <Serif>entreprise</Serif>
        </h1>
        <p className="mt-2 text-[16px] leading-[1.6] text-q-text-3 md:text-[17px]">
          Votre SIREN suffit : nous retrouvons le nom et l’adresse. Ces informations figurent sur vos devis et vos factures.
        </p>
      </div>
      <CompanyForm />
    </AuthLayout>
  )
}
