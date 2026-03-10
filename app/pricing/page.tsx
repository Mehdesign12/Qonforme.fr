import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import PricingSelector from '@/components/billing/PricingSelector'

export const metadata: Metadata = { title: 'Choisir un plan — Qonforme' }
export const dynamic = 'force-dynamic'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-[#0F172A]">Qonforme</span>
        </Link>
      </div>

      {/* Étapes d'inscription */}
      <div className="flex items-center gap-2 mb-8 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#10B981] text-white text-xs font-bold flex items-center justify-center">✓</div>
          <span className="text-sm text-slate-400 line-through">Ton compte</span>
        </div>
        <div className="w-8 h-px bg-[#10B981]" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#10B981] text-white text-xs font-bold flex items-center justify-center">✓</div>
          <span className="text-sm text-slate-400 line-through">Ton entreprise</span>
        </div>
        <div className="w-8 h-px bg-[#2563EB]" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center">3</div>
          <span className="text-sm font-medium text-[#0F172A]">Ton plan</span>
        </div>
      </div>

      {/* Titre */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-[#0F172A] mb-2">
          Choisis ton plan
        </h1>
        <p className="text-slate-500 text-base max-w-md">
          Accès immédiat dès le paiement confirmé. Résiliation à tout moment depuis les paramètres.
        </p>
      </div>

      {/* Sélecteur de plans */}
      <PricingSelector />
    </div>
  )
}
