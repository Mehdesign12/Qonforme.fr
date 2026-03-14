'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

const inputBase =
  'w-full h-12 rounded-xl border border-[#E2E8F0] bg-white/90 px-4 text-[15px] text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 disabled:opacity-50 [-webkit-appearance:none]'
const inputError =
  'border-red-400 focus:border-red-400 focus:ring-red-400/10'
const labelCls  = 'block text-[13px] font-semibold text-[#0F172A] mb-1.5'
const btnPrimary =
  'w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-[15px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(37,99,235,0.25)] touch-manipulation'

export default function AdminLoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading]   = useState(false)

  const validate = () => {
    const errs: typeof errors = {}
    if (!email.trim())    errs.email    = 'Email requis'
    if (!password.trim()) errs.password = 'Mot de passe requis'
    return errs
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      if (res.status === 401) {
        toast.error('Identifiants incorrects')
        return
      }
      if (!res.ok) {
        toast.error('Erreur serveur. Réessaie.')
        return
      }
      window.location.href = '/admin'
    } catch {
      toast.error('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>

      {/* Email */}
      <div>
        <label htmlFor="admin-email" className={labelCls}>Email admin</label>
        <input
          id="admin-email"
          type="email"
          placeholder="admin@exemple.fr"
          autoComplete="email"
          inputMode="email"
          className={`${inputBase} ${errors.email ? inputError : ''}`}
          value={email}
          onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }}
          disabled={loading}
        />
        {errors.email && <p className="text-xs text-red-500 mt-1.5">{errors.email}</p>}
      </div>

      {/* Mot de passe */}
      <div>
        <label htmlFor="admin-password" className={labelCls}>Mot de passe</label>
        <div className="relative">
          <input
            id="admin-password"
            type={showPwd ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            className={`${inputBase} pr-12 ${errors.password ? inputError : ''}`}
            value={password}
            onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })) }}
            disabled={loading}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
            onClick={() => setShowPwd(v => !v)}
            aria-label={showPwd ? 'Masquer' : 'Afficher'}
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}
      </div>

      {/* Bouton */}
      <button type="submit" className={btnPrimary} disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Connexion…' : 'Accéder à l\'espace admin'}
      </button>

    </form>
  )
}
