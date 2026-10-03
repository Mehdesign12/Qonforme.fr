import type { Metadata } from 'next'
import AuthLayout from '@/components/auth/AuthLayout'
import { AuthLead, AuthTitle, Serif } from '@/components/auth/AuthHeading'
import AdminLoginForm from '@/components/admin/AdminLoginForm'

export const metadata: Metadata = {
  title: 'Admin — Connexion',
  robots: { index: false, follow: false },
}

/** Connexion à l'espace admin, dans le style des pages d'accès de l'application. */
export default function AdminLoginPage() {
  return (
    <AuthLayout>
      <span className="q-tag mb-4 self-start !border-[var(--q-ink)] !bg-[var(--q-ink)] !text-[var(--q-surface)]">Admin</span>
      <AuthTitle>Espace <Serif>administrateur</Serif>.</AuthTitle>
      <AuthLead>Connexion réservée à l&apos;équipe Qonforme.</AuthLead>

      <AdminLoginForm />
    </AuthLayout>
  )
}
