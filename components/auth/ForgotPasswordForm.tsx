'use client'

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ChevronLeft, MailCheck } from "lucide-react"
import { AUTH_INPUT, AuthSubmit, Field } from "@/components/auth/fields"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"

/** Lien « ‹ Retour à la connexion » au-dessus du titre (canevas « Connexion »). */
function BackToLogin() {
  return (
    <Link href="/login" className="q-link mb-[18px] inline-flex items-center gap-1 self-start text-[14px] !font-medium">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Retour à la connexion
    </Link>
  )
}

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
        toast.error("Une erreur est survenue. Réessayez dans quelques instants.")
        return
      }
      setSubmitted(true)
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion et réessayez.")
    } finally {
      setLoading(false)
    }
  }

  /* ── État : email envoyé ────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="flex flex-col">
        <span className="mb-[22px] grid h-14 w-14 place-items-center rounded-2xl bg-q-wash text-q-accent-strong">
          <MailCheck className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <AuthTitle>Regardez votre <Serif>boîte mail</Serif>.</AuthTitle>
        <AuthLead>
          Si un compte existe pour{" "}
          <span className="font-semibold text-q-ink [overflow-wrap:anywhere]">{email}</span>,
          un lien de réinitialisation vient de lui être envoyé.
        </AuthLead>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/login" className="lp-btn-p w-full touch-manipulation">
            Retour à la connexion
          </Link>
          <button
            type="button"
            className="lp-btn-s w-full !px-6 touch-manipulation"
            onClick={() => { setSubmitted(false); setEmail("") }}
          >
            Utiliser une autre adresse
          </button>
        </div>

        <p className="mt-[22px] text-[13px] leading-[1.55] text-q-text-4">
          Rien reçu au bout de quelques minutes ? Vérifiez vos courriers indésirables. Le lien reste valable une heure.
        </p>
      </div>
    )
  }

  /* ── Formulaire ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col">
      <BackToLogin />
      <AuthTitle>Mot de passe <Serif>oublié</Serif> ?</AuthTitle>
      <AuthLead>
        Indiquez l’adresse de votre compte. Nous vous envoyons un lien pour en choisir un nouveau.
      </AuthLead>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <Field id="email" label="Adresse email" error={error ?? undefined}>
          <input
            id="email"
            type="email"
            placeholder="vous@exemple.fr"
            autoComplete="email"
            autoFocus
            inputMode="email"
            className={AUTH_INPUT}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "email-error" : undefined}
            value={email}
            onChange={e => { setEmail(e.target.value); if (error) setError(null) }}
            disabled={loading}
          />
        </Field>

        <AuthSubmit loading={loading} loadingLabel="Envoi en cours…" className="mt-1.5">
          Envoyer le lien
        </AuthSubmit>
      </form>
    </div>
  )
}
