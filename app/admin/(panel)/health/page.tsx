import { isAdminAuthenticated } from "@/lib/admin-require"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import { CircleCheck, CircleX, Clock, RefreshCw } from "lucide-react"
import Stripe from "stripe"
import { EmptyState, Kpi, KpiGrid, PageHeader, Panel, StatusPill } from "@/components/app/kit"
import { LoadError, fmtDateTime, fmtInt } from "@/components/admin/ui"
import { RefreshButton } from "@/components/admin/RefreshButton"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin — Santé système" }

// ── Types ──────────────────────────────────────────────────────────────────────

interface ServiceCheck {
  status: "ok" | "error"
  latencyMs?: number
  error?: string
}

interface CronLog {
  id: string
  created_at: string
  job_name: string
  status: string
  results: {
    // Mode historique (J+30 / J+45) du cron des relances
    reminder_1?: { sent: number; skipped: number; errors: string[] }
    reminder_2?: { sent: number; skipped: number; errors: string[] }
    // Mode réglages (Paramètres › Relances) : factures et devis
    invoices?: { sent: number; skipped: number; errors: string[] }
    quotes?: { sent: number; skipped: number; errors: string[] }
    error?: string
  } | null
  duration_ms: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function pingSupabase(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ServiceCheck> {
  const t0 = Date.now()
  try {
    const { error } = await admin
      .from("cron_logs")
      .select("id", { head: true, count: "exact" })
    return { status: error ? "error" : "ok", latencyMs: Date.now() - t0, error: error?.message || undefined }
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t0, error: String(e) }
  }
}

async function pingStripe(): Promise<ServiceCheck> {
  const t0 = Date.now()
  try {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { status: "error", latencyMs: 0, error: "STRIPE_SECRET_KEY manquant" }
    const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" })
    await stripe.balance.retrieve()
    return { status: "ok", latencyMs: Date.now() - t0 }
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t0, error: String(e) }
  }
}

async function pingResend(): Promise<ServiceCheck> {
  const t0 = Date.now()
  try {
    const key = process.env.RESEND_API_KEY
    if (!key) return { status: "error", latencyMs: 0, error: "RESEND_API_KEY manquant" }
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { status: "ok", latencyMs: Date.now() - t0 }
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t0, error: String(e) }
  }
}

async function getHealthData() {
  const admin = createAdminClient()

  const [supabase, stripe, resend] = await Promise.all([
    pingSupabase(admin),
    pingStripe(),
    pingResend(),
  ])

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [cronLogsRes, usersRes, newUsersRes, activeSubsRes] = await Promise.all([
    admin
      .from("cron_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    admin.auth.admin.listUsers({ perPage: 1 }),
    admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ])

  const totalUsers =
    (usersRes.data as { total?: number } | null)?.total ??
    (usersRes.data as { users?: unknown[] } | null)?.users?.length ??
    0

  // listUsers() interroge l'API Auth Admin de Supabase — un sous-système
  // distinct de PostgREST (pingSupabase ci-dessus ne l'exerce pas). Sans
  // vérifier .error, un échec réseau/API se confond avec "0 utilisateur"
  // (même piège que documenté dans CLAUDE.md pour le middleware).
  return {
    checkedAt: new Date(),
    services: { supabase, stripe, resend },
    cronLogs: (cronLogsRes.data ?? []) as CronLog[],
    cronLogsError: !!cronLogsRes.error,
    users: {
      total: totalUsers,
      totalError: !!usersRes.error,
      newThisWeek: newUsersRes.count ?? 0,
      newThisWeekError: !!newUsersRes.error,
      activeSubscriptions: activeSubsRes.count ?? 0,
      activeSubscriptionsError: !!activeSubsRes.error,
    },
  }
}

// ── Composants ────────────────────────────────────────────────────────────────

/** Tâches planifiées qui écrivent dans cron_logs (app/api/cron/*). */
const JOB_LABELS: Record<string, string> = {
  "send-reminders": "Relances de factures",
  "generate-blog": "Article de blog (IA)",
  "outreach-sequence": "Séquence de démarchage",
  "scraping-sirene": "Extraction Sirene",
  "enrich-prospects": "Enrichissement des prospects",
}

/** Tâches liées au démarchage, désactivé par décision (DECISIONS-STRATEGIQUES.md § 3). */
const PROSPECTING_JOBS = new Set(["outreach-sequence", "scraping-sirene", "enrich-prospects"])

function OkPill({ ok, okLabel = "Opérationnel", errorLabel = "En erreur" }: { ok: boolean; okLabel?: string; errorLabel?: string }) {
  return ok ? (
    <StatusPill tone="ok" icon={<CircleCheck strokeWidth={2.25} aria-hidden />}>{okLabel}</StatusPill>
  ) : (
    <StatusPill tone="danger" icon={<CircleX strokeWidth={2.25} aria-hidden />}>{errorLabel}</StatusPill>
  )
}

function ServiceCard({ name, role, check }: { name: string; role: string; check: ServiceCheck }) {
  const ok = check.status === "ok"
  return (
    <div className={`q-card flex flex-col gap-2 p-4 ${ok ? "" : "!border-[var(--q-danger-line)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="q-h2">{name}</span>
          <span className="text-[13px] text-[var(--q-text-4)]">{role}</span>
        </span>
        <OkPill ok={ok} />
      </div>
      {check.latencyMs !== undefined && (
        <p className="text-[13px] tabular-nums text-[var(--q-text-3)]">Temps de réponse : {fmtInt(check.latencyMs)} ms</p>
      )}
      {check.error && (
        <p className="line-clamp-3 break-words text-[13px] text-[var(--q-danger)]" title={check.error}>{check.error}</p>
      )}
    </div>
  )
}

function cronSummary(log: CronLog): string {
  const parts: string[] = []
  if (log.job_name === "send-reminders") {
    // Anciennes relances J+30/J+45 et, une fois les réglages activés, relances de factures et de devis
    const runs = [log.results?.reminder_1, log.results?.reminder_2, log.results?.invoices, log.results?.quotes]
    const sent = runs.reduce((n, r) => n + (r?.sent ?? 0), 0)
    const errors = runs.reduce((n, r) => n + (r?.errors?.length ?? 0), 0)
    parts.push(sent > 0 ? `${fmtInt(sent)} relance${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}` : "Aucune relance envoyée")
    if (errors > 0) parts.push(`${fmtInt(errors)} erreur${errors > 1 ? "s" : ""}`)
  } else if (log.results?.error) {
    parts.push(String(log.results.error))
  }
  if (log.duration_ms != null) parts.push(`${fmtInt(log.duration_ms)} ms`)
  return parts.join(" · ")
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HealthPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  const d = await getHealthData()
  const statsOk = !d.users.totalError && !d.users.newThisWeekError && !d.users.activeSubscriptionsError
  const allOk = Object.values(d.services).every((s) => s.status === "ok") && statsOk && !d.cronLogsError
  const prospectingRuns = d.cronLogs.filter((l) => PROSPECTING_JOBS.has(l.job_name))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Santé du système"
        subtitle={`Vérifié le ${fmtDateTime(d.checkedAt)} (heure de Paris)`}
        actions={
          <>
            <OkPill ok={allOk} okLabel="Tout est opérationnel" errorLabel="Incident détecté" />
            <RefreshButton label="Vérifier à nouveau" />
          </>
        }
      />

      <section aria-labelledby="health-services" className="flex flex-col gap-3">
        <h2 id="health-services" className="q-h2">Services externes</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <ServiceCard name="Supabase" role="Base de données" check={d.services.supabase} />
          <ServiceCard name="Stripe" role="Abonnements et paiements" check={d.services.stripe} />
          <ServiceCard name="Resend" role="Envoi des emails" check={d.services.resend} />
        </div>
      </section>

      <section aria-labelledby="health-users" className="flex flex-col gap-3">
        <h2 id="health-users" className="q-h2">Comptes</h2>
        <KpiGrid className="sm:!grid-cols-3">
          <Kpi
            label="Utilisateurs inscrits"
            value={d.users.totalError ? "—" : fmtInt(d.users.total)}
            sub={d.users.totalError ? "Données indisponibles (API d'authentification)" : "au total"}
            tone={d.users.totalError ? "warn" : "default"}
          />
          <Kpi
            label="Inscriptions sur 7 jours"
            value={d.users.newThisWeekError ? "—" : `+${fmtInt(d.users.newThisWeek)}`}
            sub={d.users.newThisWeekError ? "Données indisponibles" : "nouvelles entreprises"}
            tone={d.users.newThisWeekError ? "warn" : "default"}
          />
          <Kpi
            className="col-span-2 sm:col-span-1"
            label="Abonnés actifs"
            value={d.users.activeSubscriptionsError ? "—" : fmtInt(d.users.activeSubscriptions)}
            sub={d.users.activeSubscriptionsError ? "Données indisponibles" : "abonnements actifs"}
            tone={d.users.activeSubscriptionsError ? "warn" : "default"}
          />
        </KpiGrid>
      </section>

      <section aria-labelledby="health-cron" className="flex flex-col gap-3">
        <h2 id="health-cron" className="q-h2">Tâches planifiées — 20 dernières exécutions</h2>
        {prospectingRuns.length > 0 && (
          <p role="status" className="q-banner q-banner-warn">
            Des tâches de prospection ont tourné récemment ({prospectingRuns.map((l) => JOB_LABELS[l.job_name]).filter((v, i, a) => a.indexOf(v) === i).join(", ")}),
            alors que le démarchage est désactivé par décision. Coupez leur déclenchement dans le service de tâches planifiées.
          </p>
        )}
        {d.cronLogsError ? (
          <LoadError what="l'historique des tâches planifiées" healthLink={false} />
        ) : d.cronLogs.length === 0 ? (
          <div className="q-card">
            <EmptyState
              icon={<Clock className="size-5" aria-hidden />}
              title="Aucune exécution enregistrée"
              text="Les tâches planifiées n'ont pas encore tourné, ou le journal est vide."
            />
          </div>
        ) : (
          <Panel>
            <ul className="q-list">
              {d.cronLogs.map((log) => {
                const ok = log.status === "ok"
                return (
                  <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[var(--q-ink)]">
                        {JOB_LABELS[log.job_name] ?? log.job_name}
                        <span className="font-normal text-[var(--q-text-4)]"> · {fmtDateTime(log.created_at)}</span>
                      </span>
                      {cronSummary(log) && (
                        <span className={`line-clamp-2 break-words text-[13px] ${ok ? "text-[var(--q-text-4)]" : "text-[var(--q-danger)]"}`}>
                          {cronSummary(log)}
                        </span>
                      )}
                    </span>
                    <OkPill ok={ok} okLabel="Réussie" errorLabel="Échec" />
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-xs text-[var(--q-text-4)]">
        <RefreshCw className="size-3" aria-hidden />
        Les vérifications sont refaites à chaque ouverture de la page.
      </p>
    </div>
  )
}
