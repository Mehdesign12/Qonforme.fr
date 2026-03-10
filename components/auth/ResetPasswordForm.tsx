'use client'

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Status = "idle" | "loading" | "success" | "invalid"

// Règles de mot de passe
const RULES = [
  { id: "length",  label: "8 caractères minimum",              test: (p: string) => p.length >= 8 },
  { id: "upper",   label: "Une majuscule",                      test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",   label: "Une minuscule",                      test: (p: string) => /[a-z]/.test(p) },
  { id: "digit",   label: "Un chiffre",                         test: (p: string) => /\d/.test(p) },
]

export default function ResetPasswordForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [password, setPassword]       = useState("")
  const [confirm, setConfirm]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors]           = useState<{ password?: string; confirm?: string }>({})
  const [status, setStatus]           = useState<Status>("idle")

  // ── Échange du code PKCE au montage ─────────────────────────────────────
  // Supabase envoie un lien de la forme :
  //   https://qonforme.fr/reset-password?code=xxxxx
  // On doit échanger ce code contre une session avant d'appeler updateUser()
  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      // Pas de code = lien invalide ou expiré
      setStatus("invalid")
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error("exchangeCodeForSession error:", error.message)
        setStatus("invalid")
      }
      // Si succès : le statut reste "idle", le formulaire s'affiche
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!password)                          errs.password = "Le mot de passe est requis"
    else if (RULES.some(r => !r.test(password))) errs.password = "Le mot de passe ne respecte pas les règles"
    if (!confirm)                           errs.confirm  = "Confirme ton mot de passe"
    else if (confirm !== password)          errs.confirm  = "Les mots de passe ne correspondent pas"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Soumission ───────────────────────────────────────────────────────────
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setStatus("loading")
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        console.error("updateUser error:", error.message)
        if (error.message.includes("same password")) {
          toast.error("Le nouveau mot de passe doit être différent de l'ancien.")
        } else {
          toast.error("Une erreur est survenue. Le lien est peut-être expiré.")
        }
        setStatus("idle")
        return
      }

      // Déconnexion propre après le reset (bonne pratique sécurité)
      await supabase.auth.signOut()
      setStatus("success")
    } catch {
      toast.error("Erreur réseau. Vérifie ta connexion et réessaie.")
      setStatus("idle")
    }
  }

  // ── État : lien invalide ou expiré ───────────────────────────────────────
  if (status === "invalid") {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#FEE2E2] flex items-center justify-center">
            <XCircle className="w-8 h-8 text-[#EF4444]" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Lien invalide ou expiré</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Ce lien de réinitialisation n&apos;est plus valide.<br/>
            Les liens expirent après <strong>1 heure</strong>.
          </p>
        </div>
        <Button
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          onClick={() => router.push("/forgot-password")}
        >
          Demander un nouveau lien
        </Button>
      </div>
    )
  }

  // ── État : succès ────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Mot de passe mis à jour !</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Ton mot de passe a été modifié avec succès.<br/>
            Tu peux maintenant te connecter avec ton nouveau mot de passe.
          </p>
        </div>
        <Button
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          onClick={() => router.push("/login")}
        >
          Se connecter
        </Button>
      </div>
    )
  }

  // ── État : formulaire ────────────────────────────────────────────────────
  const allRulesPassed = RULES.every(r => r.test(password))

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>

      {/* Nouveau mot de passe */}
      <div>
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            autoFocus
            className={`pr-10 ${errors.password ? "border-red-400 focus-visible:ring-red-400" : ""}`}
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (errors.password) setErrors(p => ({ ...p, password: undefined }))
            }}
            disabled={status === "loading"}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500 mt-1">{errors.password}</p>
        )}

        {/* Règles de mot de passe */}
        {password.length > 0 && !allRulesPassed && (
          <ul className="mt-2 space-y-1">
            {RULES.map(rule => {
              const ok = rule.test(password)
              return (
                <li key={rule.id} className={`flex items-center gap-1.5 text-xs ${ok ? "text-[#10B981]" : "text-slate-400"}`}>
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
        <Label htmlFor="confirm">Confirme le mot de passe</Label>
        <div className="relative mt-1">
          <Input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            className={`pr-10 ${errors.confirm ? "border-red-400 focus-visible:ring-red-400" : ""}`}
            value={confirm}
            onChange={e => {
              setConfirm(e.target.value)
              if (errors.confirm) setErrors(p => ({ ...p, confirm: undefined }))
            }}
            disabled={status === "loading"}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setShowConfirm(v => !v)}
            aria-label={showConfirm ? "Masquer" : "Afficher"}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirm && (
          <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Mise à jour…
          </>
        ) : (
          "Enregistrer le nouveau mot de passe"
        )}
      </Button>
    </form>
  )
}
