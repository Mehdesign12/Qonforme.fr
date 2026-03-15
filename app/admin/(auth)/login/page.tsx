import type { Metadata } from 'next'
import { Shield } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import AdminLoginForm from '@/components/admin/AdminLoginForm'

export const metadata: Metadata = { title: 'Admin — Connexion' }

export default function AdminLoginPage() {
  return (
    <AuthLayout maxWidth="sm">
      <div
        className="rounded-2xl border border-white/70 p-5 sm:p-7 md:p-8 md:backdrop-blur-lg"
        style={{
          background: 'rgba(255,255,255,0.85)',
          boxShadow:  '0 8px 32px rgba(37,99,235,0.10), 0 1px 0 rgba(255,255,255,0.8) inset',
        }}
      >
        {/* Badge ADMIN */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2563EB] shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white bg-red-500 rounded px-1.5 py-0.5 leading-none">
            ADMIN
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-1 leading-tight">
          Espace administrateur
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Connexion réservée aux administrateurs
        </p>

        <AdminLoginForm />
      </div>
    </AuthLayout>
  )
}
