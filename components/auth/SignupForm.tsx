'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { safeNextPath } from "@/lib/stripe/access"
import { trackEvent } from "@/lib/meta-pixel"
import { AUTH_INPUT, AuthSubmit, Field, PasswordInput } from "@/components/auth/fields"
import { SIGNUP_EMAIL_PATTERN, SIGNUP_PASSWORD_MIN } from "@/lib/auth/signup-input"

/**
 * Inscription en deux champs (maquette validée le 06/10/2026) : adresse email
 * et mot de passe. L'entreprise, le métier, la TVA et le prénom se renseignent
 * ensuite dans la fenêtre « Bienvenue » du tableau de bord, ouverte d'office
 * à l'arrivée (`?bienvenue=1`). Mêmes seuils que la route (lib/auth/signup-input.ts).
 */
function validate(fields: { email: string; password: string }) {
  const errs: Record<string, string> = {}
  if (!fields.email.trim() || !SIGNUP_EMAIL_PATTERN.test(fields.email.trim()))
    errs.email = "Adresse email invalide"
  if (!fields.password || fields.password.length < SIGNUP_PASSWORD_MIN)
    errs.password = `${SIGNUP_PASSWORD_MIN} caractères minimum`
  return errs
}

export default function SignupForm() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const [fields, setFields] = useState({ email: "", password: "" })

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
          email:    fields.email.trim(),
          password: fields.password,
        }),
      })
      const json = await res.json().catch(() => ({}))

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

      trackEvent("Lead", { currency: "EUR", value: 0 })
      // Retour à la page qui a demandé l'inscription (invitation d'un comptable :
      // pas d'entreprise à créer) ; sinon le tableau de bord, où la fenêtre
      // « Bienvenue » s'ouvre avec la mention « Compte créé »
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"))
      if (next) {
        toast.success("Compte créé.")
        router.push(next)
      } else {
        router.push("/dashboard?bienvenue=1")
      }
    } catch {
      toast.error("Une erreur inattendue s'est produite. Réessayez.", { duration: 8000 })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-[18px]" noValidate>

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
      <Field id="password" label="Mot de passe" error={errors.password} hint="8&nbsp;caractères minimum">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          error={errors.password}
          hint
          value={fields.password}
          onChange={set("password")}
          disabled={loading}
        />
      </Field>

      {/* CTA */}
      <AuthSubmit loading={loading} loadingLabel="Création en cours…" className="mt-1 sm:mt-1.5">
        Créer mon compte
      </AuthSubmit>

      {/* CGU */}
      <p className="m-0 text-[13px] leading-[1.55] text-q-text-4">
        En créant un compte, vous acceptez les{" "}
        <a href="/cgu" className="q-link !font-medium">conditions d’utilisation</a>{" "}
        et la{" "}
        <a href="/confidentialite" className="q-link !font-medium">politique de confidentialité</a>.
        {/* Information à la collecte (CPCE art. L34-5, CNIL) : voir lib/onboarding/unsubscribe.ts */}
        {" "}Qonforme peut vous envoyer quelques conseils de démarrage par email pendant vos 30&nbsp;premiers jours&nbsp;; un
        lien dans chacun permet de les arrêter.
      </p>
    </form>
  )
}
