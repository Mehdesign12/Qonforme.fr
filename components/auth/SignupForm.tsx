'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { safeNextPath } from "@/lib/stripe/access"
import { trackEvent } from "@/lib/meta-pixel"
import { AUTH_INPUT, AuthSubmit, Field, PasswordInput } from "@/components/auth/fields"

function validate(fields: {
  first_name: string; last_name: string
  email: string; password: string; confirm_password: string
}) {
  const errs: Record<string, string> = {}
  if (!fields.first_name || fields.first_name.trim().length < 2)
    errs.first_name = "Prénom requis (2 caractères min.)"
  if (!fields.last_name || fields.last_name.trim().length < 2)
    errs.last_name = "Nom requis (2 caractères min.)"
  if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errs.email = "Adresse email invalide"
  if (!fields.password || fields.password.length < 8)
    errs.password = "8 caractères minimum"
  if (!fields.confirm_password)
    errs.confirm_password = "Confirmation requise"
  else if (fields.password !== fields.confirm_password)
    errs.confirm_password = "Les mots de passe ne correspondent pas"
  return errs
}

export default function SignupForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const [fields, setFields] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  })

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    try {
      // ── Étape 1 : création serveur (admin.createUser, email_confirm: true)
      // Contourne le SMTP Supabase et évite le 500 auth/v1/signup
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:      fields.email.trim(),
          password:   fields.password,
          first_name: fields.first_name.trim(),
          last_name:  fields.last_name.trim(),
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (res.status === 409 || json.error === "already_exists") {
          toast.error("Cet email est déjà utilisé. Connectez-vous.", { duration: 6000 })
        } else {
          toast.error(json.error ?? "Erreur lors de la création du compte.", { duration: 8000 })
        }
        setLoading(false)
        return
      }

      // ── Étape 2 : connexion immédiate pour établir la session + cookies
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    fields.email.trim(),
        password: fields.password,
      })
      if (signInError) {
        toast.error("Compte créé mais connexion échouée. Connectez-vous manuellement.", { duration: 8000 })
        router.push("/login")
        return
      }

      // Retour à la page qui a demandé l'inscription (invitation d'un comptable : pas d'entreprise à créer)
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"))
      toast.success(next ? "Compte créé." : "Compte créé. Il reste votre entreprise.")
      trackEvent("Lead", { currency: "EUR", value: 0 })
      router.push(next ?? "/signup/company")
    } catch {
      toast.error("Une erreur inattendue s'est produite. Réessayez.", { duration: 8000 })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>

      {/* Prénom + Nom */}
      <div className="grid grid-cols-2 gap-3">
        <Field id="first_name" label="Prénom" error={errors.first_name}>
          <input
            id="first_name"
            placeholder="Thomas"
            autoComplete="given-name"
            className={AUTH_INPUT}
            aria-invalid={errors.first_name ? true : undefined}
            aria-describedby={errors.first_name ? "first_name-error" : undefined}
            value={fields.first_name}
            onChange={set("first_name")}
            disabled={loading}
          />
        </Field>
        <Field id="last_name" label="Nom" error={errors.last_name}>
          <input
            id="last_name"
            placeholder="Garnier"
            autoComplete="family-name"
            className={AUTH_INPUT}
            aria-invalid={errors.last_name ? true : undefined}
            aria-describedby={errors.last_name ? "last_name-error" : undefined}
            value={fields.last_name}
            onChange={set("last_name")}
            disabled={loading}
          />
        </Field>
      </div>

      {/* Email */}
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
          value={fields.email}
          onChange={set("email")}
          disabled={loading}
        />
      </Field>

      {/* Mot de passe */}
      <Field id="password" label="Mot de passe" error={errors.password} hint="8 caractères minimum">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          error={errors.password}
          value={fields.password}
          onChange={set("password")}
          disabled={loading}
        />
      </Field>

      {/* Confirmation */}
      <Field id="confirm_password" label="Confirmer le mot de passe" error={errors.confirm_password}>
        <PasswordInput
          id="confirm_password"
          autoComplete="new-password"
          error={errors.confirm_password}
          value={fields.confirm_password}
          onChange={set("confirm_password")}
          disabled={loading}
        />
      </Field>

      {/* CTA */}
      <AuthSubmit loading={loading} loadingLabel="Création en cours…" className="mt-1.5">
        Créer mon compte
      </AuthSubmit>

      {/* CGU */}
      <p className="mt-2 text-[13px] leading-[1.55] text-q-text-4">
        En créant un compte, vous acceptez les{" "}
        <a href="/cgu" className="q-link !font-medium">conditions d’utilisation</a>{" "}
        et la{" "}
        <a href="/confidentialite" className="q-link !font-medium">politique de confidentialité</a>.
      </p>
    </form>
  )
}
