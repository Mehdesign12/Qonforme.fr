import type { Metadata } from "next"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"
import AuthLayout from "@/components/auth/AuthLayout"
import { AuthPhotoPanel } from "@/components/auth/AuthPhotoPanel"
import { LOGIN_PHOTO } from "@/components/auth/photos"

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  description: "Réinitialisez votre mot de passe Qonforme. Un lien de récupération sera envoyé à votre adresse email en quelques secondes.",
  alternates: { canonical: "/forgot-password" },
}
export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <AuthLayout aside={<AuthPhotoPanel {...LOGIN_PHOTO} />} asideVariant="photo">
      {/* Titre dans le formulaire : il change une fois le lien envoyé */}
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
