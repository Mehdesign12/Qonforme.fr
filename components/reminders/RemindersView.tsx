'use client'

/**
 * Relances : la file d'envoi (ce que le cron enverra dans les 14 prochains
 * jours), les factures relancées jusqu'au bout et toujours impayées, et
 * l'historique des 30 derniers jours.
 *
 * Présentationnelle et partagée : la page réelle lui passe les données de
 * /api/relances, la démo celles de lib/demo (règle « Mode démo » de CLAUDE.md).
 * La file vient de lib/reminders/queue.ts, qui rejoue le planificateur du cron.
 */

import { useMemo } from "react"
import Link from "next/link"
import { AlertTriangle, BellRing, ChevronRight, Clock, Info, MailX, RefreshCw, SlidersHorizontal } from "lucide-react"
import { EmptyState, Kpi, KpiGrid, PageHeader, Panel, StatusPill } from "@/components/app/kit"
import { formatCurrency } from "@/lib/utils/invoice"
import { plural } from "@/components/invoices/invoice-view"
import { addDays, parisDayOf } from "@/lib/utils/paris-date"
import { describeInvoiceSchedule, type ReminderSettings } from "@/lib/reminders/settings"
import {
  QUEUE_DAYS, HISTORY_DAYS, buildReminderQueue, type QueueEntry, type QueueInvoice, type QueueQuote, type SentEntry,
} from "@/lib/reminders/queue"

export type RemindersMode = "app" | "demo"

interface Props {
  mode: RemindersMode
  /** Aujourd'hui (Paris) ; null tant qu'il n'est pas connu (rendu serveur). */
  today: string | null
  /** null pendant le chargement. */
  data: {
    settings: ReminderSettings
    invoices: QueueInvoice[]
    quotes: QueueQuote[]
    /** Ancien fonctionnement (J+30 et J+45), migration des réglages pas encore appliquée. */
    legacy: boolean
    /** Formule active (le cron saute les comptes sans formule) ; null si inconnu. */
    hasPlan: boolean | null
  } | null
  error?: string | null
  onRetry?: () => void
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
const timeFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function dayLabel(day: string, today: string): string {
  if (day === today) return "Aujourd'hui"
  if (day === addDays(today, 1)) return "Demain"
  const [y, m, d] = day.split("-").map(Number)
  return upper(dayFmt.format(new Date(Date.UTC(y, m - 1, d, 12))))
}

const ORIGIN: Record<SentEntry["origin"], string> = { auto: "Automatique", manual: "À la main", legacy: "Automatique" }

export function RemindersView({ mode, today, data, error, onRetry }: Props) {
  const base = mode === "demo" ? "/demo" : ""
  const docHref = (type: "invoice" | "quote", id: string) => `${base}/${type === "invoice" ? "invoices" : "quotes"}/${id}`
  const settingsHref = `${base}/settings/notifications`

  const queue = useMemo(
    () => (data && today ? buildReminderQueue({ invoices: data.invoices, quotes: data.quotes, settings: data.settings, today }) : null),
    [data, today],
  )

  const header = (
    <PageHeader
      title="Relances"
      subtitle={`Ce qui part tout seul dans les ${QUEUE_DAYS} prochains jours, et ce qui est déjà parti`}
      actions={
        <Link href={settingsHref} className="q-btn q-btn-secondary">
          <SlidersHorizontal aria-hidden />
          Régler les relances
        </Link>
      }
    />
  )

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="q-card">
          <EmptyState
            icon={<BellRing className="size-5" aria-hidden />}
            title="Impossible de charger les relances"
            text={error}
            action={onRetry && (
              <button type="button" className="q-btn q-btn-secondary" onClick={onRetry}>
                <RefreshCw aria-hidden />
                Réessayer
              </button>
            )}
          />
        </section>
      </div>
    )
  }

  if (!data || !queue || !today) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="q-card h-[420px] animate-pulse" aria-busy="true" aria-label="Chargement des relances" />
      </div>
    )
  }

  const { settings } = data
  const todayCount = queue.upcoming.filter((e) => e.date === today).length
  const schedule = describeInvoiceSchedule(settings)
  const groups = groupByDay(queue.upcoming)

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* Ce qui empêche des relances de partir */}
      {mode === "app" && data.hasPlan === false && (
        <div role="status" className="q-banner q-banner-warn items-start">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-[15px] leading-snug">
            <strong className="font-semibold">Vos relances automatiques sont en pause.</strong> Elles font partie de la formule
            Essentiel : sans elle, rien ne part. La liste montre ce qui partirait.{" "}
            <Link href="/settings/billing" className="font-semibold underline">Voir les formules</Link>
          </span>
        </div>
      )}
      {!settings.invoiceRemindersEnabled && (
        <div role="status" className="q-banner items-start">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-[15px] leading-snug">
            Les relances des factures sont désactivées.{" "}
            <Link href={settingsHref} className="font-semibold underline">Paramètres › Relances</Link>
          </span>
        </div>
      )}
      {data.legacy && (
        <div role="note" className="q-banner items-start">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="flex-1 text-[15px] leading-snug">
            Vos factures impayées sont relancées 30 puis 45 jours après l&apos;échéance. Le rappel avant l&apos;échéance, les relances à J+7
            et J+15 et la relance des devis seront réglables très bientôt.
          </span>
        </div>
      )}

      <KpiGrid>
        <Kpi
          label={`À venir sous ${QUEUE_DAYS} jours`}
          value={String(queue.upcoming.length)}
          sub={queue.upcoming.length ? `${todayCount} aujourd'hui` : "Aucune relance prévue"}
        />
        <Kpi label={`Envoyées sur ${HISTORY_DAYS} jours`} value={String(queue.sent.length)} sub={schedule ? `Factures : ${schedule}` : "Relances des factures coupées"} />
        <Kpi
          tone={queue.exhausted.length ? "warn" : "default"}
          icon={queue.exhausted.length ? <Clock className="size-3.5" strokeWidth={2.25} aria-hidden /> : undefined}
          label="À traiter vous-même"
          value={String(queue.exhausted.length)}
          sub={queue.exhausted.length ? "Relancées jusqu'au bout, toujours impayées" : "Aucune facture bloquée"}
        />
        <Kpi
          label="Sans adresse email"
          value={String(queue.noEmail)}
          sub={queue.noEmail ? "Leurs relances ne partiront pas" : "Toutes vos relances peuvent partir"}
        />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="À venir" aria-label="Relances à venir" bodyClassName="p-0">
          {groups.length === 0 ? (
            <EmptyState
              className="py-10"
              icon={<BellRing className="size-5" aria-hidden />}
              title={`Aucune relance dans les ${QUEUE_DAYS} prochains jours`}
              text="Les factures envoyées et non réglées apparaîtront ici, à la date où leur relance partira."
            />
          ) : (
            <div className="flex flex-col">
              {groups.map((g) => (
                <section key={g.day} aria-label={dayLabel(g.day, today)} className="border-t border-[var(--q-line-soft)] first:border-t-0">
                  <h3 className="bg-[var(--q-surface-2)] px-4 py-2 text-[13px] font-semibold text-[var(--q-text-3)]">
                    {dayLabel(g.day, today)} · {plural(g.entries.length, "relance", "relances")}
                  </h3>
                  <div className="q-list">
                    {g.entries.map((e) => (
                      <Link key={`${e.type}-${e.id}-${e.stage}`} href={docHref(e.type, e.id)} className="q-list-row">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[14px]">{e.number}</span>
                            <StatusPill tone={e.type === "quote" ? "neutral" : e.stage.startsWith("before") ? "info" : "warn"}>{e.label}</StatusPill>
                            {e.isLast && e.type === "invoice" && <span className="text-[12px] text-[var(--q-text-4)]">dernière relance</span>}
                          </span>
                          <span className="truncate text-[13px] text-[var(--q-text-3)]">
                            {e.type === "quote" ? "Devis · " : ""}{e.client}
                          </span>
                          {e.noEmail && (
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--q-warn)]">
                              <MailX className="size-3.5" aria-hidden />Pas d&apos;adresse email : elle ne partira pas
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-[14px] font-semibold tabular-nums">{formatCurrency(e.amount)}</span>
                        <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          {queue.exhausted.length > 0 && (
            <Panel title="Relancées jusqu'au bout" aria-label="Factures relancées jusqu'au bout" bodyClassName="p-0">
              <p className="px-4 pb-2 text-[13px] leading-relaxed text-[var(--q-text-3)]">
                Toutes les relances automatiques sont parties et la facture reste impayée : appelez votre client ou envoyez une mise en demeure.
              </p>
              <div className="q-list border-t border-[var(--q-line-soft)]">
                {queue.exhausted.map((x) => (
                  <Link key={x.id} href={docHref("invoice", x.id)} className="q-list-row">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-mono text-[14px]">{x.number}</span>
                      <span className="truncate text-[13px] text-[var(--q-text-3)]">{x.client}</span>
                      <span className="text-[12px] font-semibold text-[var(--q-warn)]">
                        {x.daysLate}&nbsp;j de retard · {plural(x.count, "relance", "relances")}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums">{formatCurrency(x.amount)}</span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}

          <Panel title={`Déjà envoyées (${HISTORY_DAYS} jours)`} aria-label="Relances envoyées" bodyClassName="p-0">
            {queue.sent.length === 0 ? (
              <p className="px-4 pb-4 text-[14px] text-[var(--q-text-3)]">Aucune relance envoyée ces {HISTORY_DAYS} derniers jours.</p>
            ) : (
              <div className="q-list">
                {queue.sent.slice(0, 30).map((s, i) => (
                  <Link key={`${s.id}-${s.at}-${i}`} href={docHref(s.type, s.id)} className="q-list-row !min-h-[52px]">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-[14px]">
                        <span className="font-mono">{s.number}</span>
                        <span className="text-[var(--q-text-3)]">{s.label}</span>
                      </span>
                      <span className="truncate text-[12px] text-[var(--q-text-4)]">
                        {s.client} · {ORIGIN[s.origin]} · {timeFmt.format(new Date(s.at))}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Comment ça marche" aria-label="Comment ça marche">
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-[var(--q-text-3)]">
              <li>Une fois par jour, Qonforme envoie les relances du jour, une seule par document, au nom de votre entreprise, avec une copie à l&apos;adresse de votre entreprise.</li>
              <li>Jamais deux relances à moins de 3 jours d&apos;écart, relances manuelles comprises.</li>
              <li>Une facture marquée payée sort de la liste tout de suite.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function groupByDay(entries: QueueEntry[]): { day: string; entries: QueueEntry[] }[] {
  const out: { day: string; entries: QueueEntry[] }[] = []
  for (const e of entries) {
    const day = parisDayOf(e.date)
    const last = out[out.length - 1]
    if (last && last.day === day) last.entries.push(e)
    else out.push({ day, entries: [e] })
  }
  return out
}
