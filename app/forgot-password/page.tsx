import type { Metadata } from "next"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"
import AuthLayout from "@/components/auth/AuthLayout"

export const metadata: Metadata = { title: "Mot de passe oublié — Qonforme" }
export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-[0_8px_32px_rgba(37,99,235,0.10)] p-6 sm:p-8">
        <div className="mb-6">
          {/* Icône */}
          <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Mot de passe oublié ?</h1>
          <p className="text-slate-500 text-sm">
            Saisis ton adresse email et on t&apos;envoie un lien pour le réinitialiser.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </AuthLayout>
  )
}
