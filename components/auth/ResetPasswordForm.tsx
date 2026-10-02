'use client'

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Check, CircleCheck, Link2Off, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthSubmit, Field, PasswordInput } from "@/components/auth/fields"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"
import { cn } from "@/lib/utils"

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
      errs.confirm = "Confirmez votre mot de passe"
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
          toast.error("Session expirée. Demandez un nouveau lien de réinitialisation.")
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
          toast.error("Le lien a expiré. Demandez un nouveau lien de réinitialisation.")
          setStatus("invalid")
        } else if (error.status === 401) {
          toast.error("Session expirée. Demandez un nouveau lien.")
          setStatus("invalid")
        } else {
          toast.error("Une erreur est survenue. Demandez un nouveau lien.")
          setStatus("idle")
        }
        return
      }

      await supabase.auth.signOut()
      setStatus("success")
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion et réessayez.")
      setStatus("idle")
    }
  }

  /* ── États alternatifs ─────────────────────────────────────────────────── */

  if (status === "verifying") {
    return (
      <div className="flex flex-col">
        <AuthTitle>Un nouveau <Serif>mot de passe</Serif>.</AuthTitle>
        <div className="mt-10 flex items-center gap-3 text-[14px] text-q-text-3" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-q-accent" aria-hidden />
          Vérification du lien…
        </div>
      </div>
    )
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col">
        <span className="mb-[22px] grid h-14 w-14 place-items-center rounded-2xl bg-q-danger-bg text-q-danger">
          <Link2Off className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <AuthTitle>Ce lien n’est plus <Serif>valable</Serif>.</AuthTitle>
        <AuthLead>
          Les liens de réinitialisation expirent au bout d’une heure et ne servent qu’une fois.
          Demandez-en un nouveau.
        </AuthLead>
        <AuthSubmit type="button" className="mt-8" onClick={() => router.push("/forgot-password")}>
          Demander un nouveau lien
        </AuthSubmit>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="flex flex-col">
        <span className="mb-[22px] grid h-14 w-14 place-items-center rounded-2xl bg-q-ok-bg text-q-ok">
          <CircleCheck className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <AuthTitle>Mot de passe <Serif>modifié</Serif>.</AuthTitle>
        <AuthLead>Votre nouveau mot de passe est enregistré. Vous pouvez vous connecter.</AuthLead>
        <AuthSubmit type="button" className="mt-8" onClick={() => router.push("/login")}>
          Se connecter
        </AuthSubmit>
      </div>
    )
  }

  /* ── Formulaire ────────────────────────────────────────────────────────── */
  const allRulesPassed = RULES.every(r => r.test(password))
  const passedCount    = RULES.filter(r => r.test(password)).length

  return (
    <div className="flex flex-col">
      <AuthTitle>Un nouveau <Serif>mot de passe</Serif>.</AuthTitle>
      <AuthLead>Choisissez un mot de passe sûr, que vous n’utilisez nulle part ailleurs.</AuthLead>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>

        {/* Nouveau mot de passe */}
        <div>
          <Field id="password" label="Nouveau mot de passe" error={errors.password}>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              error={errors.password}
              value={password}
              onChange={e => {
                setPassword(e.target.value)
                if (errors.password) setErrors(p => ({ ...p, password: undefined }))
              }}
              disabled={status === "loading"}
            />
          </Field>

          {/* Barre de force */}
          {password.length > 0 && (
            <div className="mt-2.5 flex gap-1" aria-hidden>
              {RULES.map((rule, i) => (
                <div
                  key={rule.id}
                  className="h-1 flex-1 rounded-full transition-colors duration-300"
                  style={{
                    background: i < passedCount
                      ? allRulesPassed ? "var(--q-ok)" : "var(--q-warn)"
                      : "var(--q-line)",
                  }}
                />
              ))}
            </div>
          )}

          {/* Règles de sécurité */}
          {password.length > 0 && !allRulesPassed && (
            <ul className="q-inset mt-3 flex flex-col gap-1.5 p-3">
              {RULES.map(rule => {
                const ok = rule.test(password)
                return (
                  <li key={rule.id} className={cn("flex items-center gap-2 text-[13px] font-medium", ok ? "text-q-ok" : "text-q-text-4")}>
                    {ok
                      ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                      : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-q-field" aria-hidden />
                    }
                    {rule.label}
                    <span className="sr-only">{ok ? " : respecté" : " : à respecter"}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Confirmation */}
        <div>
          <Field id="confirm" label="Confirmer le mot de passe" error={errors.confirm}>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              error={errors.confirm}
              value={confirm}
              onChange={e => {
                setConfirm(e.target.value)
                if (errors.confirm) setErrors(p => ({ ...p, confirm: undefined }))
              }}
              disabled={status === "loading"}
            />
          </Field>

          {/* Indicateur de correspondance */}
          {confirm.length > 0 && !errors.confirm && (
            confirm === password
              ? <p className="q-field-ok mt-1.5"><Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> Les mots de passe correspondent</p>
              : <p className="q-field-hint mt-1.5">Les mots de passe ne correspondent pas encore</p>
          )}
        </div>

        <AuthSubmit loading={status === "loading"} loadingLabel="Mise à jour…" className="mt-1.5">
          Enregistrer le mot de passe
        </AuthSubmit>
      </form>
    </div>
  )
}
