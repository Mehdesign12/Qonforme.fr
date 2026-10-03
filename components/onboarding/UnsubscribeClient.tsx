"use client"

/**
 * Désinscription des conseils de démarrage en un clic (lien de l'email) : la
 * page enregistre le refus dès son affichage, par une requête POST (jamais par
 * le simple GET du lien, que les analyseurs de messagerie ouvrent tout seuls),
 * puis propose de revenir en arrière.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, Loader2, RefreshCw } from "lucide-react"

type State = "working" | "unsubscribed" | "subscribed" | "error"

export function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<State>("working")
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  const submit = useCallback(async (subscribe: boolean) => {
    setBusy(true)
    try {
      const res = await fetch("/api/emails/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subscribe }),
      })
      setState(res.ok ? (subscribe ? "subscribed" : "unsubscribed") : "error")
    } catch {
      setState("error")
    } finally {
      setBusy(false)
    }
  }, [token])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void submit(false)
  }, [submit])

  if (state === "working") {
    return (
      <p className="flex items-center gap-2 text-[16px] text-q-text-3" role="status">
        <Loader2 className="size-5 animate-spin text-q-accent" aria-hidden />
        Enregistrement…
      </p>
    )
  }

  if (state === "error") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[16px] leading-relaxed text-q-text-3" role="alert">
          Votre demande n&apos;a pas pu être enregistrée. Réessayez dans un instant, ou désactivez les conseils
          depuis Paramètres › Relances, une fois connecté.
        </p>
        <button type="button" className="q-btn q-btn-primary q-btn-lg self-start" onClick={() => submit(false)} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="q-banner q-banner-ok" role="status">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          {state === "unsubscribed"
            ? "C'est fait : vous ne recevrez plus les conseils de démarrage de Qonforme."
            : "C'est noté : vous recevrez de nouveau les conseils de démarrage."}
        </p>
      </div>
      <p className="text-[15px] leading-relaxed text-q-text-3">
        Les e-mails liés à vos documents (envoi de vos devis et factures, copies, relances de vos clients) et à la
        sécurité de votre compte ne sont pas concernés.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/dashboard" className="q-btn q-btn-secondary q-btn-lg">Aller au tableau de bord</Link>
        <button type="button" className="q-btn q-btn-ghost q-btn-lg" onClick={() => submit(state === "unsubscribed")} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {state === "unsubscribed" ? "Je veux les recevoir de nouveau" : "Ne plus les recevoir"}
        </button>
      </div>
    </div>
  )
}
