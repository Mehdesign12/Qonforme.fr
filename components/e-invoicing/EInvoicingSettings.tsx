"use client"

/**
 * Paramètres › Facturation électronique (canevas, planche 13 et M10) :
 * raccordement, notifications par email, changer de plateforme ou retirer le
 * raccordement. Partagé par l'application et la démo. Raccordement pas encore
 * proposé à ce compte : la page d'avant (EInvoicingView), qui reste vraie.
 */
import { useState } from "react"
import Link from "next/link"
import { ArrowRight, RefreshCw } from "lucide-react"
import { PageHeader, StatusPill, Switch } from "@/components/app/kit"
import type { ShellMode } from "@/components/layout/nav"
import { settingsHref } from "@/components/settings/sections"
import { EInvoicingView as LegacyEInvoicingView } from "@/components/settings/EInvoicingView"
import { Field, SettingRow, SettingsCard } from "@/components/settings/ui"
import { cn } from "@/lib/utils"
import { SUPERPDP_LABEL } from "@/lib/pa/superpdp/config"
import { PA_STATUS_LABEL, PA_STATUS_TONE } from "@/lib/pa/status"
import type { EInvoicingView } from "@/lib/pa/view"
import { Facts, fmtDayTime } from "@/components/e-invoicing/parts"
import type { HubNotice } from "@/components/e-invoicing/EInvoicingHub"

export interface NotifyPatch { digest?: boolean; each?: boolean; failure?: boolean; email?: string }

export function EInvoicingSettings({
  mode,
  view,
  loading,
  error,
  busy,
  notice,
  hubHref,
  receivedHref,
  onRetry,
  onRefresh,
  onRemove,
  onNotify,
}: {
  mode: ShellMode
  view: EInvoicingView | null
  loading: boolean
  error: string | null
  busy?: boolean
  notice?: HubNotice | null
  hubHref: string
  receivedHref: string
  onRetry: () => void
  onRefresh: (sync?: boolean) => void
  onRemove: () => void
  onNotify: (patch: NotifyPatch) => Promise<boolean>
}) {
  const [email, setEmail] = useState<string | null>(null)

  if (loading && !view) return <div className="q-shimmer h-64 rounded-2xl" aria-busy="true" />
  if (error && !view) {
    return (
      <div className="q-banner q-banner-danger">
        <span className="flex-1">{error}</span>
        <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={onRetry}>Réessayer</button>
      </div>
    )
  }
  if (!view || !view.available) return <LegacyEInvoicingView mode={mode} />

  const c = view.connection
  const emailValue = email ?? c?.notify.email ?? ""

  return (
    <>
      <PageHeader
        title="Facturation électronique"
        subtitle="Votre raccordement à la plateforme agréée et ses notifications"
        backHref={settingsHref("/settings", mode)}
        backLabel="Paramètres"
      />
      {notice && <div className={cn("q-banner", notice.tone === "danger" && "q-banner-danger", notice.tone === "ok" && "q-banner-ok")} role="status">{notice.text}</div>}

      <SettingsCard
        id="raccordement"
        title="Raccordement"
        description="La plateforme qui reçoit vos factures fournisseurs."
        action={c ? <StatusPill tone={view.hasPlan ? PA_STATUS_TONE[c.status] : "warn"}>{view.hasPlan ? PA_STATUS_LABEL[c.status] : "Réception suspendue"}</StatusPill> : undefined}
      >
        {c ? (
          <>
            <Facts rows={[
              { label: "Plateforme", value: SUPERPDP_LABEL },
              { label: "Adresse de facturation électronique", value: c.address ?? "—", mono: true },
              { label: "Annuaire", value: c.status === "active" ? "Adresse trouvée" : c.status === "directory_missing" ? "Adresse introuvable" : "En attente" },
              { label: "Dernière relève", value: fmtDayTime(c.lastSyncAt) },
            ]} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="q-btn q-btn-secondary q-btn-sm" onClick={() => onRefresh(true)} disabled={busy || !view.hasPlan}>
                <RefreshCw className={cn(busy && "animate-spin")} aria-hidden />
                Relever maintenant
              </button>
              <button type="button" className="q-btn q-btn-ghost q-btn-sm" onClick={() => onRefresh(false)} disabled={busy}>Vérifier l&apos;annuaire</button>
              <Link href={hubHref} className="q-btn q-btn-ghost q-btn-sm">Détail du raccordement<ArrowRight aria-hidden /></Link>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--q-text-3)]">
              Pas encore activé. {view.hasPlan ? `Raccordez Qonforme à ${SUPERPDP_LABEL} : vos factures fournisseurs arriveront seules.` : "Le raccordement est inclus dans Essentiel."}
            </p>
            <Link href={hubHref} className="q-btn q-btn-primary q-btn-sm">Activer<ArrowRight aria-hidden /></Link>
          </div>
        )}
      </SettingsCard>

      {c && (
        <SettingsCard id="notifications" title="Notifications" description="Les emails que Qonforme vous envoie pour vos factures reçues.">
          <SettingRow title="Résumé quotidien par email" text="Un seul email par jour, en fin de journée, seulement s'il y a de nouvelles factures reçues.">
            <Switch checked={c.notify.digest} label="Résumé quotidien par email" onCheckedChange={(v) => void onNotify({ digest: v })} />
          </SettingRow>
          <SettingRow title="Prévenir à chaque facture reçue" text="Un email dès qu'une facture arrive. Peut faire beaucoup d'emails.">
            <Switch checked={c.notify.each} label="Prévenir à chaque facture reçue" onCheckedChange={(v) => void onNotify({ each: v })} />
          </SettingRow>
          <SettingRow title="Alerter si la relève échoue" text="Un email si Qonforme n'est plus autorisé à lire vos factures.">
            <Switch checked={c.notify.failure} label="Alerter si la relève échoue" onCheckedChange={(v) => void onNotify({ failure: v })} />
          </SettingRow>
          <form
            className="flex flex-wrap items-end gap-2 border-t border-[var(--q-line-soft)] pt-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await onNotify({ email: emailValue })) setEmail(null)
            }}
          >
            <Field label="Adresse email des notifications" htmlFor="pa-notify-email" className="min-w-[220px] flex-1">
              <input id="pa-notify-email" type="email" className="q-input" value={emailValue} onChange={(e) => setEmail(e.target.value)} placeholder="Adresse du compte si vide" />
            </Field>
            <button type="submit" className="q-btn q-btn-secondary" disabled={email === null || busy}>Enregistrer</button>
          </form>
        </SettingsCard>
      )}

      {c && (
        <SettingsCard id="changer" title="Changer de plateforme ou retirer le raccordement" description="Vos factures déjà reçues restent dans Qonforme.">
          <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
            Si vous retirez le raccordement, Qonforme ne relève plus rien. Si vous changez de plateforme, désignez la
            nouvelle auprès d&apos;elle : c&apos;est elle qui met à jour l&apos;annuaire, et vous importez ici les factures
            qu&apos;elle reçoit.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={receivedHref + "/import"} className="q-btn q-btn-secondary">J&apos;utilise une autre plateforme agréée</Link>
            <button type="button" className="q-btn q-btn-danger" onClick={onRemove} disabled={busy}>Retirer le raccordement</button>
          </div>
        </SettingsCard>
      )}
    </>
  )
}
