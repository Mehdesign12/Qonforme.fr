'use client'

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react"

/* ─── classes communes ──────────────────────────────────────────────────── */
const inputBase =
  "w-full h-12 rounded-xl border border-[#E2E8F0] bg-white/90 px-4 text-[15px] text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 disabled:opacity-50 [-webkit-appearance:none]"
const inputError =
  "border-red-400 focus:border-red-400 focus:ring-red-400/10"
const labelCls  = "block text-[13px] font-semibold text-[#0F172A] mb-1.5"
const btnPrimary =
  "w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-[15px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(37,99,235,0.25)] touch-manipulation"
const btnSecondary =
  "w-full h-12 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] active:scale-[0.98] text-[#0F172A] text-[15px] font-medium transition-all flex items-center justify-center gap-2 touch-manipulation"
const btnGhost =
  "w-full h-12 rounded-xl text-slate-500 hover:text-[#0F172A] text-[15px] font-medium transition-all flex items-center justify-center gap-2 hover:bg-white/60 touch-manipulation"

export default function ForgotPasswordForm() {
  const [email, setEmail]         = useState("")
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validate = (): string | null => {
    if (!email.trim())                               return "L'adresse email est requise"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Adresse email invalide"
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) {
        toast.error("Une erreur est survenue. Réessaie dans quelques instants.")
        return
      }
      setSubmitted(true)
    } catch {
      toast.error("Erreur réseau. Vérifie ta connexion et réessaie.")
    } finally {
      setLoading(false)
    }
  }

  /* ── État : email envoyé ────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="text-center space-y-5">
        {/* Icône succès */}
        <div className="flex justify-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#D1FAE5] flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-[#10B981]" />
          </div>
        </div>

        <div>
          <h2 className="text-[17px] font-bold text-[#0F172A]">Vérifie ta boîte mail</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Si un compte existe pour{" "}
            <span className="font-semibold text-[#0F172A]">{email}</span>,
            tu recevras un lien de réinitialisation dans quelques minutes.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Pense à vérifier tes spams si tu ne le vois pas.
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => { setSubmitted(false); setEmail("") }}
          >
            <Mail className="w-4 h-4" />
            Utiliser une autre adresse
          </button>
          <Link href="/login" className="block">
            <button type="button" className={btnGhost}>
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </button>
          </Link>
        </div>
      </div>
    )
  }

  /* ── Formulaire ─────────────────────────────────────────────────────────── */
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className={labelCls}>Adresse email</label>
        <input
          id="email"
          type="email"
          placeholder="jean@exemple.fr"
          autoComplete="email"
          autoFocus
          inputMode="email"
          className={`${inputBase} ${error ? inputError : ""}`}
          value={email}
          onChange={e => { setEmail(e.target.value); if (error) setError(null) }}
          disabled={loading}
        />
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>

      <button type="submit" className={btnPrimary} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          "Envoyer le lien de réinitialisation"
        )}
      </button>

      <Link href="/login" className="block">
        <button type="button" className={`${btnGhost} mt-1`}>
          <ArrowLeft className="w-4 h-4" />
          Retour à la connexion
        </button>
      </Link>
    </form>
  )
}
