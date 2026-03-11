import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Zap } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";

const PICTO_Q = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/Logos/Logo%20bleu%20Qonforme%20PNG.webp";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC] flex items-center justify-center p-4">
      {/* Q filigrane côté droit */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-1/2 -translate-y-1/2 select-none hidden lg:block"
        style={{ opacity: 0.08, zIndex: 0 }}
      >
        <Image src={PICTO_Q} alt="" width={420} height={420} className="w-[380px]" unoptimized />
      </div>
      <div className="relative z-10 w-full max-w-md">
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
