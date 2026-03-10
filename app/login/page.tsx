import type { Metadata } from "next";
import Link from "next/link";
import { Zap } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-[#0F172A]">Qonforme</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Content de te revoir</h1>
          <p className="text-slate-500 text-sm mb-6">Connecte-toi à ton espace Qonforme</p>
          <LoginForm />
          <p className="text-center text-sm text-slate-500 mt-6">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="text-[#2563EB] hover:underline font-medium">
              Essai gratuit 7 jours
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
