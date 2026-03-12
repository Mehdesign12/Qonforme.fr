'use client'

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle, KeyRound, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/* ─── styles ───────────────────────────────────────────────────────────────── */
const inputBase =
  "w-full h-12 rounded-xl border border-[#E2E8F0] bg-white/90 px-4 text-[15px] text-[#0F172A] placeholder:text-slate-400 outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 disabled:opacity-50 [-webkit-appearance:none]"
const inputError =
  "border-red-400 focus:border-red-400 focus:ring-red-400/10"
const labelCls = "block text-[13px] font-semibold text-[#0F172A] mb-1.5"
const btnPrimary =
  "w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(37,99,235,0.25)] touch-manipulation"

type Status = "verifying" | "idle" | "loading" | "success" | "invalid"

const RULES = [
  { id: "length", label: "8 caractères minimum", test: (p: string) => p.length >= 8 },
  { id: "upper",  label: "Une majuscule",         test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",  label: "Une minuscule",         test: (p: string) => /[a-z]/.test(p) },
  { id: "digit",  label: "Un chiffre",            test: (p: string) => /\d/.test(p) },
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
    // ── Cas 1 : lien invalide signalé par le callback ─────────────────────
    const errorParam = searchParams.get("error")
    if (errorParam === "invalid") { setStatus("invalid"); return }

    async function initSession() {
      if (typeof window === "undefined") return

      // ── Cas 2 : lien Supabase natif avec hash fragment ─────────────────
      // URL format : /reset-password#access_token=xxx&refresh_token=yyy&type=recovery
      const hash   = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const accessToken  = params.get("access_token")
      const refreshToken = params.get("refresh_token")
      const type         = params.get("type")

      if (accessToken && refreshToken && type === "recovery") {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          console.error("setSession error:", error.message)
          setStatus("invalid")
          return
        }
        // Nettoie le hash
        window.history.replaceState(null, "", window.location.pathname)
        setStatus("idle")
        return
      }

      // ── Cas 3 : session établie via /api/auth/callback (cookie) ────────
      // On tente getSession d'abord, puis refreshSession si besoin
      let session = null
      try {
        const { data } = await supabase.auth.getSession()
        session = data.session
      } catch (e) {
        console.error("getSession error:", e)
      }

      if (!session) {
        // Tentative de refresh pour récupérer une session expirée ou mal synchronisée
        try {
          const { data } = await supabase.auth.refreshSession()
          session = data.session
        } catch (e) {
          console.error("refreshSession error:", e)
        }
      }

      setStatus(session ? "idle" : "invalid")
    }

    initSession()
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
      // Double-check session avant l'appel updateUser
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Tentative de refreshSession si la session semble absente
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshData.session) {
          toast.error("Session expirée. Demande un nouveau lien de réinitialisation.")
          setStatus("invalid")
          return
        }
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        console.error("updateUser error:", error.message, error.status)
        if (error.message.toLowerCase().includes("same password") ||
            error.message.toLowerCase().includes("should be different")) {
          toast.error("Le nouveau mot de passe doit être différent de l'ancien.")
          setStatus("idle")
        } else if (error.status === 422) {
          // 422 = session invalide / token expiré — demander un nouveau lien
          toast.error("Le lien a expiré. Demande un nouveau lien de réinitialisation.")
          setStatus("invalid")
        } else if (error.status === 401) {
          toast.error("Session expirée. Demande un nouveau lien.")
          setStatus("invalid")
        } else {
          toast.error("Une erreur est survenue. Demande un nouveau lien.")
          setStatus("idle")
        }
        return
      }

      await supabase.auth.signOut()
      setStatus("success")
    } catch {
      toast.error("Erreur réseau. Vérifie ta connexion et réessaie.")
      setStatus("idle")
    }
  }

  /* ── États alternatifs ─────────────────────────────────────────────────── */

  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <div className="w-12 h-12 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Vérification du lien…</p>
      </div>
    )
  }

  if (status === "invalid") {
    return (
      <div className="text-center space-y-5 py-2">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FEE2E2] flex items-center justify-center">
            <XCircle className="w-8 h-8 text-[#EF4444]" />
          </div>
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-[#0F172A]">Lien invalide ou expiré</h2>
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
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-5 py-2">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#D1FAE5] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
          </div>
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-[#0F172A]">Mot de passe mis à jour !</h2>
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
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    )
  }

  /* ── Formulaire ────────────────────────────────────────────────────────── */
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
            inputMode="text"
            className={`${inputBase} pr-12 ${errors.password ? inputError : ""}`}
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (errors.password) setErrors(p => ({ ...p, password: undefined }))
            }}
            disabled={status === "loading"}
          />
          <button
            type="button" tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors rounded-lg touch-manipulation"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? "Masquer" : "Afficher"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1.5">{errors.password}</p>}

        {/* Règles de sécurité */}
        {password.length > 0 && !allRulesPassed && (
          <ul className="mt-3 space-y-1.5 bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
            {RULES.map(rule => {
              const ok = rule.test(password)
              return (
                <li key={rule.id} className={`flex items-center gap-2 text-xs font-medium ${ok ? "text-[#10B981]" : "text-slate-400"}`}>
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

        {/* Barre de force */}
        {password.length > 0 && (
          <div className="mt-2.5 flex gap-1">
            {RULES.map((rule, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: rule.test(password)
                    ? i < 2 ? "#F97316" : i < 3 ? "#EAB308" : "#10B981"
                    : "#E2E8F0"
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation */}
      <div>
        <label htmlFor="confirm" className={labelCls}>Confirmer le mot de passe</label>
        <div className="relative">
          <input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            inputMode="text"
            className={`${inputBase} pr-12 ${errors.confirm ? inputError : ""}`}
            value={confirm}
            onChange={e => {
              setConfirm(e.target.value)
              if (errors.confirm) setErrors(p => ({ ...p, confirm: undefined }))
            }}
            disabled={status === "loading"}
          />
          <button
            type="button" tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors rounded-lg touch-manipulation"
            onClick={() => setShowConfirm(v => !v)}
            aria-label={showConfirm ? "Masquer" : "Afficher"}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirm && <p className="text-xs text-red-500 mt-1.5">{errors.confirm}</p>}

        {/* Indicateur match */}
        {confirm.length > 0 && (
          <p className={`text-xs mt-1.5 flex items-center gap-1.5 font-medium ${confirm === password ? "text-[#10B981]" : "text-slate-400"}`}>
            {confirm === password
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Les mots de passe correspondent</>
              : <><div className="w-3.5 h-3.5 rounded-full border border-slate-300" /> Les mots de passe ne correspondent pas encore</>
            }
          </p>
        )}
      </div>

      <button
        type="submit"
        className={btnPrimary}
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Mise à jour…</>
        ) : (
          <><KeyRound className="w-4 h-4" /> Enregistrer le nouveau mot de passe</>
        )}
      </button>
    </form>
  )
}
