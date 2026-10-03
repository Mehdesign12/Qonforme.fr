"use client"

/**
 * Page d'invitation du comptable (/invitation-comptable), dans la coque des
 * pages d'accès. Le jeton est dans un cookie HttpOnly (jamais dans l'adresse) ;
 * cette vue ne le voit pas : l'acceptation le relit côté serveur.
 *
 * États : invitation valide (pas connecté, connecté à la bonne adresse,
 * à une autre adresse, ou compte de l'entreprise elle-même), expirée,
 * introuvable (acceptée, annulée ou remplacée), indisponible.
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, Check, Clock, Loader2, LogOut, SearchX, UserCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { purgePwaPageCache } from "@/lib/pwa/client"
import { AuthLead, AuthTitle, Serif } from "@/components/auth/AuthHeading"
import { dayOf } from "@/components/accountant/format"
import type { InvitationState } from "@/lib/accountant/types"

const NEXT = encodeURIComponent("/invitation-comptable")

const SEES = [
  "Les factures émises et les avoirs, avec leur statut de paiement",
  "Les totaux et la TVA facturée de la période de votre choix",
  "Le FEC, l'export des ventes (CSV) et les PDF de la période",
]

function Bullets() {
  return (
    <ul className="mt-6 flex flex-col gap-2.5">
      {SEES.map((s) => (
        <li key={s} className="flex items-start gap-2.5 text-[15px] text-q-text-2">
          <Check className="mt-0.5 size-4 shrink-0 text-[var(--q-ok)]" strokeWidth={2.5} aria-hidden />
          {s}
        </li>
      ))}
    </ul>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-[13px] leading-relaxed text-q-text-4">{children}</p>
}

function StateIcon({ children }: { children: React.ReactNode }) {
  return <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-[var(--q-sunken)] text-[var(--q-text-3)]">{children}</span>
}

export function InvitationView({ invitation, viewerEmail }: { invitation: InvitationState; viewerEmail: string | null }) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchAccount = async () => {
    await createClient().auth.signOut()
    purgePwaPageCache()
    window.location.href = `/login?next=${NEXT}`
  }

  const accept = async () => {
    setAccepting(true)
    setError(null)
    try {
      const res = await fetch("/api/accountant-access/accept", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.accessId) { setError(json.error ?? "L'acceptation a échoué. Réessayez."); return }
      toast.success("Invitation acceptée")
      router.push(`/comptable/${json.accessId}`)
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setAccepting(false)
    }
  }

  if (invitation.state === "unavailable") {
    return (
      <>
        <StateIcon><AlertCircle className="size-6" aria-hidden /></StateIcon>
        <AuthTitle>Invitation indisponible</AuthTitle>
        <AuthLead>L&apos;invitation ne peut pas être lue pour le moment. Réessayez dans quelques minutes depuis le lien de l&apos;email.</AuthLead>
      </>
    )
  }

  if (invitation.state === "not_found") {
    return (
      <>
        <StateIcon><SearchX className="size-6" aria-hidden /></StateIcon>
        <AuthTitle>Ce lien n&apos;est plus valide</AuthTitle>
        <AuthLead>
          L&apos;invitation a peut-être déjà été acceptée, annulée ou remplacée par une plus récente. Si vous l&apos;avez
          acceptée, le dossier vous attend dans votre espace comptable.
        </AuthLead>
        <div className="mt-7 flex flex-col gap-2.5">
          {viewerEmail ? (
            <Link href="/comptable" className="q-btn q-btn-primary q-btn-xl w-full">Espace comptable</Link>
          ) : (
            <Link href={`/login?next=${encodeURIComponent("/comptable")}`} className="q-btn q-btn-primary q-btn-xl w-full">Se connecter</Link>
          )}
        </div>
      </>
    )
  }

  if (invitation.state === "expired") {
    return (
      <>
        <StateIcon><Clock className="size-6" aria-hidden /></StateIcon>
        <AuthTitle>Cette invitation a expiré</AuthTitle>
        <AuthLead>
          Demandez à {invitation.companyName} de vous la renvoyer depuis Qonforme (Paramètres › Accès comptable) :
          vous recevrez un nouveau lien.
        </AuthLead>
      </>
    )
  }

  const { companyName, maskedEmail, expiresAt, emailMatches, isOwner } = invitation

  return (
    <>
      <AuthTitle>{companyName} vous invite à consulter sa <Serif>facturation</Serif>.</AuthTitle>
      <AuthLead>En lecture seule : rien ne peut être modifié ni envoyé depuis votre accès.</AuthLead>
      <Bullets />

      {isOwner ? (
        <div className="mt-7 flex flex-col gap-3">
          <div className="q-banner q-banner-warn" role="status">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-[13px] leading-relaxed">
              Vous êtes connecté avec le compte de l&apos;entreprise qui a envoyé cette invitation. Elle est destinée à votre
              comptable ({maskedEmail}).
            </p>
          </div>
          <Link href="/settings/comptable" className="q-btn q-btn-secondary q-btn-xl w-full">Retour à l&apos;accès comptable</Link>
        </div>
      ) : emailMatches === false ? (
        <div className="mt-7 flex flex-col gap-3">
          <div className="q-banner q-banner-warn" role="status">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-[13px] leading-relaxed">
              Vous êtes connecté avec {viewerEmail}. Cette invitation est destinée à {maskedEmail} : connectez-vous avec
              cette adresse pour l&apos;accepter.
            </p>
          </div>
          <button type="button" onClick={switchAccount} className="q-btn q-btn-primary q-btn-xl w-full">
            <LogOut aria-hidden />
            Changer de compte
          </button>
        </div>
      ) : emailMatches === true ? (
        <div className="mt-7 flex flex-col gap-3">
          {error && (
            <div className="q-banner border-[var(--q-danger-line)] bg-[var(--q-danger-bg)] text-[var(--q-danger)]" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-[13px] leading-relaxed">{error}</p>
            </div>
          )}
          <button type="button" onClick={accept} disabled={accepting} className="q-btn q-btn-primary q-btn-xl w-full">
            {accepting ? <Loader2 className="animate-spin" aria-hidden /> : <UserCheck aria-hidden />}
            {accepting ? "Acceptation…" : "Accepter l'invitation"}
          </button>
          <p className="text-center text-[13px] text-q-text-4">Connecté avec {viewerEmail}</p>
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-2.5">
          <Link href={`/signup?next=${NEXT}`} className="q-btn q-btn-primary q-btn-xl w-full">Créer mon compte gratuit</Link>
          <Link href={`/login?next=${NEXT}`} className="q-btn q-btn-secondary q-btn-xl w-full">J&apos;ai déjà un compte</Link>
          <p className="mt-1 text-center text-[13px] text-q-text-4">
            Avec l&apos;adresse {maskedEmail}. Aucune entreprise à renseigner.
          </p>
        </div>
      )}

      <Notice>
        Invitation valable jusqu&apos;au {dayOf(expiresAt)}. Vos consultations et téléchargements sont enregistrés et
        visibles par {companyName} pendant un an ; l&apos;accès peut vous être retiré à tout moment.
      </Notice>
    </>
  )
}
