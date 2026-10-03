'use client'

import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { safeNextPath } from "@/lib/stripe/access"
import { AUTH_INPUT, AuthSubmit, Field, PasswordInput } from "@/components/auth/fields"

export default function LoginForm() {
  const supabase = createClient()

  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({})
  const [loading, setLoading]   = useState(false)

  /* Validation */
  const validate = () => {
    const errs: typeof errors = {}
    if (!email.trim())                                        errs.email    = "Adresse email requise"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))     errs.email    = "Adresse email invalide"
    if (!password)                                            errs.password = "Mot de passe requis"
    else if (password.length < 8)                             errs.password = "8 caractères minimum"
    return errs
  }

  /* Connexion */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
          toast.error("Email ou mot de passe incorrect.")
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Vérifiez votre boîte mail pour confirmer votre adresse.")
        } else if (error.message.includes("too many requests") || error.message.includes("rate limit")) {
          toast.error("Trop de tentatives. Patientez quelques minutes.")
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success("Connexion réussie !")
      // Retour à la page qui a demandé la connexion (invitation d'un comptable…), chemin interne seulement
      window.location.href = safeNextPath(new URLSearchParams(window.location.search).get("next")) ?? '/dashboard'
    } catch {
      toast.error("Erreur réseau. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>

      <Field id="email" label="Adresse email" error={errors.email}>
        <input
          id="email"
          type="email"
          placeholder="vous@exemple.fr"
          autoComplete="email"
          inputMode="email"
          className={AUTH_INPUT}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          value={email}
          onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }}
          disabled={loading}
        />
      </Field>

      <Field
        id="password"
        label="Mot de passe"
        error={errors.password}
        aside={<a href="/forgot-password" className="q-link text-[13px] !font-medium">Mot de passe oublié ?</a>}
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          error={errors.password}
          value={password}
          onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })) }}
          disabled={loading}
        />
      </Field>

      <AuthSubmit loading={loading} loadingLabel="Connexion…" className="mt-1.5">
        Se connecter
      </AuthSubmit>

    </form>
  )
}
