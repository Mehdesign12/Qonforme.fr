import type { Metadata } from "next"
import Link from "next/link"
import LoginForm from "@/components/auth/LoginForm"
import AuthLayout from "@/components/auth/AuthLayout"

export const metadata: Metadata = { title: "Connexion — Qonforme" }
export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-[0_8px_32px_rgba(37,99,235,0.10)] p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Content de te revoir</h1>
        <p className="text-slate-500 text-sm mb-7">Connecte-toi à ton espace Qonforme</p>

        <LoginForm />

        <p className="text-center text-sm text-slate-500 mt-6">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="text-[#2563EB] hover:underline font-semibold">
            Créer un compte
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
