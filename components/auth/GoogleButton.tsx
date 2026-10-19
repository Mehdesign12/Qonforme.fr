'use client'

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { safeNextPath } from "@/lib/stripe/access"
import { oauthRedirectTo } from "@/lib/auth/oauth"
import { cn } from "@/lib/utils"

/** « G » de Google aux couleurs de la charte de marque Google (ne pas modifier). */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.9 7.35 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * Bouton « Continuer avec Google » des pages de connexion et d'inscription.
 * Navigation complète vers Google (rien à charger de plus) ; au retour,
 * /api/auth/callback établit la session. Ni flou ni `will-change` (règle iOS).
 */
export default function GoogleButton({ label = "Continuer avec Google", className }: { label?: string; className?: string }) {
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirectTo(window.location.origin, {
            next: safeNextPath(params.get("next")),
            ab: params.get("ab"),
          }),
          // Laisse choisir le compte Google quand plusieurs sont connectés
          queryParams: { prompt: "select_account" },
        },
      })
      if (error) {
        toast.error("Connexion avec Google impossible pour le moment. Réessayez ou utilisez votre email.")
        setLoading(false)
      }
      // Sans erreur, le navigateur part vers Google : on laisse le bouton occupé
    } catch {
      toast.error("Erreur réseau. Réessayez.")
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex h-[52px] w-full touch-manipulation items-center justify-center gap-3 rounded-full border border-[var(--q-field)] bg-[var(--q-surface)]",
        "text-base font-semibold text-[var(--q-ink-strong)] transition-colors duration-150 hover:bg-[var(--q-wash)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--q-accent)]",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      {loading ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <GoogleG className="size-[18px]" />}
      {label}
    </button>
  )
}

/** Séparateur « ou » entre le bouton Google et le formulaire par email. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-q-text-4" role="separator">
      <span className="h-px flex-1 bg-[var(--q-line)]" />
      ou
      <span className="h-px flex-1 bg-[var(--q-line)]" />
    </div>
  )
}
