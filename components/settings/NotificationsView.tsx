/**
 * Paramètres › Notifications (planche « Paramètres — Notifications »),
 * version honnête : les alertes ne se règlent pas encore une à une. La page
 * dit ce que Qonforme envoie réellement et à quelle adresse :
 *   - copie (CC) de chaque devis, facture et relance envoyés à un client,
 *     à l'adresse de l'entreprise, sinon à celle du compte
 *     (app/api/{invoices,quotes}/[id]/send, app/api/invoices/[id]/remind) ;
 *   - relances automatiques 30 et 45 jours après l'échéance, pour les comptes
 *     qui ont une formule, en copie à l'adresse de l'entreprise si elle est
 *     renseignée (app/api/cron/send-reminders).
 * Pas de notification sur le téléphone, pas de résumé hebdomadaire (non livrés).
 * Partagé par l'application et la démo.
 */
import Link from "next/link"
import { Mail, Pencil } from "lucide-react"
import { PageHeader, StatusPill } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { SettingsCard } from "@/components/settings/ui"

export function NotificationsView({
  mode,
  companyEmail,
  accountEmail,
  hasPlan,
}: {
  mode: ShellMode
  companyEmail: string
  accountEmail: string
  /** Formule qui permet d'émettre (les relances automatiques en dépendent). */
  hasPlan: boolean
}) {
  const address = companyEmail || accountEmail

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Les e-mails que Qonforme envoie pour vous"
        backHref={settingsHref("/settings", mode)}
        backLabel="Paramètres"
      />

      <SettingsCard id="envois" title="Ce que vous recevez">
        <div className="-mx-5 -mb-5">
          <div className="flex items-center justify-between gap-3 border-y border-[var(--q-line-soft)] px-5 py-2.5 text-xs text-[var(--q-text-4)]">
            <span>Événement</span>
            <span>E-mail</span>
          </div>
          <ul className="q-list">
            <Row
              title="Copie de chaque envoi"
              text="Devis, factures et relances que vous envoyez à vos clients : vous êtes en copie, et vos clients vous répondent directement."
              status={<StatusPill tone="ok">Toujours</StatusPill>}
            />
            <Row
              title="Relances automatiques des impayés"
              text="30 puis 45 jours après l'échéance, Qonforme relance par e-mail le client d'une facture impayée. Copie à l'adresse de votre entreprise, si elle est renseignée."
              status={hasPlan
                ? <StatusPill tone="ok">Actives</StatusPill>
                : <StatusPill tone="info">Avec Essentiel</StatusPill>}
            />
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard
        id="adresse"
        title="Adresse utilisée"
        description="Les copies partent à l'adresse e-mail de votre entreprise. Sans elle, celles de vos envois partent à l'adresse de votre compte."
      >
        <div className="q-inset flex items-center gap-3 p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
            <Mail className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold text-[var(--q-ink)]">{address || "Aucune adresse"}</span>
            <span className="text-[13px] text-[var(--q-text-4)]">
              {companyEmail ? "E-mail de l'entreprise" : "E-mail du compte, faute d'adresse d'entreprise"}
            </span>
          </span>
          <Link href={settingsHref("/settings/company", mode)} className="q-btn q-btn-secondary q-btn-sm shrink-0">
            <Pencil aria-hidden />
            Modifier
          </Link>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--q-text-4)]">
          Qonforme n&apos;envoie pas d&apos;autre alerte pour l&apos;instant : ni notification sur le téléphone, ni résumé
          par e-mail. Vos factures en retard restent visibles dans la liste des factures.
        </p>
      </SettingsCard>
    </>
  )
}

function Row({ title, text, status }: { title: string; text: string; status: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-[var(--q-ink)]">{title}</span>
        <span className="text-[13px] leading-relaxed text-[var(--q-text-4)]">{text}</span>
      </span>
      <span className="shrink-0">{status}</span>
    </li>
  )
}
