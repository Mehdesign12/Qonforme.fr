import type { Metadata } from "next"
import { Suspense } from "react"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import AuthLayout from "@/components/auth/AuthLayout"
import AuthBenefits from "@/components/auth/AuthBenefits"

export const metadata: Metadata = { title: "Nouveau mot de passe — Qonforme" }
export const dynamic = "force-dynamic"

export default function ResetPasswordPage() {
  return (
    <AuthLayout aside={<AuthBenefits />}>
      {/* Titre dans le formulaire : il suit l'état du lien (vérification, invalide, réussi).
          Suspense requis — ResetPasswordForm utilise useSearchParams() */}
      <Suspense fallback={
        <div className="flex items-center gap-3 py-8 text-[14px] text-q-text-3">
          <span className="h-5 w-5 rounded-full border-2 border-q-accent border-t-transparent animate-spin" aria-hidden />
          Chargement…
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  )
}
