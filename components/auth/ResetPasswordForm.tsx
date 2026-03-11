'use client'

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/* ─── classes communes ──────────────────────────────────────────────────── */
const inputBase =
  "w-full h-11 rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 disabled:opacity-50"
const inputError =
  "border-red-400 focus:border-red-400 focus:ring-red-400/10"
const labelCls  = "block text-[13px] font-semibold text-[#0F172A] mb-1.5"
const btnPrimary =
  "w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"

type Status = "verifying" | "idle" | "loading" | "success" | "invalid"

const RULES = [
  { id: "length", label: "8 caractères minimum",   test: (p: string) => p.length >= 8 },
  { id: "upper",  label: "Une majuscule",           test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",  label: "Une minuscule",           test: (p: string) => /[a-z]/.test(p) },
  { id: "digit",  label: "Un chiffre",              test: (p: string) => /\d/.test(p) },
]

export default function ResetPasswordForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [password, setPassword]         = useState("")
  const [confirm, setConfirm]           = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [errors, setErrors]             = useState<{ password?: string; confirm?: string }>({})
  const [status, setStatus]             = useState<Status>("verifying")

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam === "invalid") { setStatus("invalid"); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "idle" : "invalid")
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!password)
      errs.password = "Le mot de passe est requis"
    else if (RULES.some(r => !r.test(password)))
      errs.password = "Le mot de passe ne respecte pas les règles"
    if (!confirm)
      errs.confirm = "Confirme ton mot de passe"
    else if (confirm !== password)
      errs.confirm = "Les mots de passe ne correspondent pas"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setStatus("loading")
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        if (error.message.toLowerCase().includes("same password")) {
          toast.error("Le nouveau mot de passe doit être différent de l'ancien.")
        } else {
          toast.error("Une erreur est survenue. Demande un nouveau lien.")
        }
        setStatus("idle")
        return
      }
      await supabase.auth.signOut()
      setStatus("success")
    } catch {
      toast.error("Erreur réseau. Vérifie ta connexion et réessaie.")
      setStatus("idle")
    }
  }

  /* ── Vérification en cours ─────────────────────────────────────────────── */
  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
        <p className="text-sm text-slate-500">Vérification en cours…</p>
      </div>
    )
  }

  /* ── Lien invalide ─────────────────────────────────────────────────────── */
  if (status === "invalid") {
    return (
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FEE2E2] flex items-center justify-center">
            <XCircle className="w-8 h-8 text-[#EF4444]" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">Lien invalide ou expiré</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Ce lien de réinitialisation n&apos;est plus valide.<br />
            Les liens expirent après <strong>1 heure</strong>.
          </p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => router.push("/forgot-password")}
        >
          Demander un nouveau lien
        </button>
      </div>
    )
  }

  /* ── Succès ────────────────────────────────────────────────────────────── */
  if (status === "success") {
    return (
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#D1FAE5] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">Mot de passe mis à jour !</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Ton mot de passe a été modifié avec succès.<br />
            Tu peux maintenant te connecter.
          </p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => router.push("/login")}
        >
          Se connecter
        </button>
      </div>
    )
  }

  /* ── Formulaire ─────────────────────────────────────────────────────────── */
  const allRulesPassed = RULES.every(r => r.test(password))

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>

      {/* Nouveau mot de passe */}
      <div>
        <label htmlFor="password" className={labelCls}>Nouveau mot de passe</label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            autoFocus
            className={`${inputBase} pr-11 ${errors.password ? inputError : ""}`}
            value={password}
            onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })) }}
            disabled={status === "loading"}
          />
          <button
            type="button" tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? "Masquer" : "Afficher"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}

        {/* Règles de sécurité */}
        {password.length > 0 && !allRulesPassed && (
          <ul className="mt-2.5 space-y-1.5 bg-[#F8FAFC] rounded-[10px] p-3">
            {RULES.map(rule => {
              const ok = rule.test(password)
              return (
                <li key={rule.id} className={`flex items-center gap-2 text-xs ${ok ? "text-[#10B981]" : "text-slate-400"}`}>
                  {ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                  }
                  {rule.label}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Confirmation */}
      <div>
        <label htmlFor="confirm" className={labelCls}>Confirme le mot de passe</label>
        <div className="relative">
          <input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            className={`${inputBase} pr-11 ${errors.confirm ? inputError : ""}`}
            value={confirm}
            onChange={e => { setConfirm(e.target.value); if (errors.confirm) setErrors(p => ({ ...p, confirm: undefined })) }}
            disabled={status === "loading"}
          />
          <button
            type="button" tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setShowConfirm(v => !v)}
            aria-label={showConfirm ? "Masquer" : "Afficher"}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirm && <p className="text-xs text-red-500 mt-1.5">{errors.confirm}</p>}
      </div>

      <button type="submit" className={btnPrimary} disabled={status === "loading"}>
        {status === "loading" ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Mise à jour…</>
        ) : (
          "Enregistrer le nouveau mot de passe"
        )}
      </button>
    </form>
  )
}
