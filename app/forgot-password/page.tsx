import type { Metadata } from "next"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"
import AuthLayout from "@/components/auth/AuthLayout"
import AuthBenefits from "@/components/auth/AuthBenefits"

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  description: "Réinitialisez votre mot de passe Qonforme. Un lien de récupération sera envoyé à votre adresse email en quelques secondes.",
  alternates: { canonical: "/forgot-password" },
}
export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <AuthLayout aside={<AuthBenefits />}>
      {/* Titre dans le formulaire : il change une fois le lien envoyé */}
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
