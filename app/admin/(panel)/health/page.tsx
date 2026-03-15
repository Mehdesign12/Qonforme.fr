import { isAdminAuthenticated } from "@/lib/admin-require"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import {
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Users,
  CreditCard,
  UserPlus,
  RefreshCw,
} from "lucide-react"
import Stripe from "stripe"

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
    reminder_1?: { sent: number; skipped: number; errors: string[] }
    reminder_2?: { sent: number; skipped: number; errors: string[] }
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
    return { status: error ? "error" : "ok", latencyMs: Date.now() - t0 }
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t0, error: String(e) }
  }
}

async function pingStripe(): Promise<ServiceCheck> {
  const t0 = Date.now()
  try {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { status: "error", latencyMs: 0, error: "STRIPE_SECRET_KEY manquant" }
    const stripe = new Stripe(key, { apiVersion: "2025-01-27.acacia" })
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
      .limit(10),
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

  return {
    checkedAt: new Date(),
    services: { supabase, stripe, resend },
    cronLogs: (cronLogsRes.data ?? []) as CronLog[],
    users: {
      total: totalUsers,
      newThisWeek: newUsersRes.count ?? 0,
      activeSubscriptions: activeSubsRes.count ?? 0,
    },
  }
}

// ── Composants ────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: "ok" | "error" }) {
  return status === "ok" ? (
    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
  ) : (
    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
  )
}

function ServiceCard({
  name,
  check,
}: {
  name: string
  check: ServiceCheck
}) {
  const ok = check.status === "ok"
  return (
    <div
      className={`rounded-2xl border p-4 ${
        ok
          ? "bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]"
          : "bg-red-50/80 dark:bg-red-900/10 border-red-200 dark:border-red-900/40"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <StatusIcon status={check.status} />
        <span className="font-semibold text-[#0F172A] dark:text-[#E2E8F0] text-sm">{name}</span>
        <span
          className={`ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 ${
            ok
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {ok ? "OK" : "ERREUR"}
        </span>
      </div>
      {check.latencyMs !== undefined && (
        <p className="text-[12px] text-slate-400 dark:text-slate-500">
          Latence : {check.latencyMs} ms
        </p>
      )}
      {check.error && (
        <p className="text-[12px] text-red-500 dark:text-red-400 mt-1 truncate">{check.error}</p>
      )}
    </div>
  )
}

function CronRow({ log }: { log: CronLog }) {
  const ok = log.status === "ok"
  const r1 = log.results?.reminder_1
  const r2 = log.results?.reminder_2
  const totalSent = (r1?.sent ?? 0) + (r2?.sent ?? 0)
  const totalErrors = (r1?.errors?.length ?? 0) + (r2?.errors?.length ?? 0)

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
      <div className="shrink-0">
        {ok ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">
          {new Date(log.created_at).toLocaleString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="text-[11px] text-slate-400">
          {totalSent > 0 ? `${totalSent} relance${totalSent > 1 ? "s" : ""} envoyée${totalSent > 1 ? "s" : ""}` : "Aucune relance"}
          {totalErrors > 0 && (
            <span className="text-red-500 ml-1">· {totalErrors} erreur{totalErrors > 1 ? "s" : ""}</span>
          )}
          {log.duration_ms != null && (
            <span className="ml-1">· {log.duration_ms} ms</span>
          )}
        </p>
      </div>
      <span
        className={`text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0 ${
          ok
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        }`}
      >
        {ok ? "OK" : "ERREUR"}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HealthPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login")

  const d = await getHealthData()
  const allOk = Object.values(d.services).every((s) => s.status === "ok")

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight tracking-tight">
            Santé système
          </h1>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-0.5">
            Vérifié à {d.checkedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        {/* Indicateur global */}
        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
            allOk
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {allOk ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          {allOk ? "Tout est opérationnel" : "Incident détecté"}
        </div>
      </div>

      {/* Services externes */}
      <div>
        <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Services externes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ServiceCard name="Supabase (base de données)" check={d.services.supabase} />
          <ServiceCard name="Stripe (paiements)" check={d.services.stripe} />
          <ServiceCard name="Resend (emails)" check={d.services.resend} />
        </div>
      </div>

      {/* Stats utilisateurs */}
      <div>
        <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Utilisateurs
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</span>
            </div>
            <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">
              {d.users.total.toLocaleString("fr-FR")}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">inscrits</p>
          </div>
          <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">7 derniers jours</span>
            </div>
            <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">
              +{d.users.newThisWeek}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">nouvelles inscriptions</p>
          </div>
          <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Abonnés actifs</span>
            </div>
            <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">
              {d.users.activeSubscriptions}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">abonnements actifs</p>
          </div>
        </div>
      </div>

      {/* Historique cron */}
      <div>
        <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Historique cron — relances automatiques (10 derniers runs)
        </h2>
        <div className="rounded-2xl border bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F] overflow-hidden">
          {d.cronLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Clock className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm font-medium">Aucun run enregistré</p>
              <p className="text-xs mt-1">Le cron n&apos;a pas encore tourné ou la table est vide</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
              {d.cronLogs.map((log) => (
                <CronRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Note refresh */}
      <p className="text-[11px] text-slate-300 dark:text-slate-600 flex items-center gap-1.5 pb-4">
        <RefreshCw className="w-3 h-3" />
        Cette page se recharge à chaque visite. Actualisez la fenêtre pour voir les données en temps réel.
      </p>

    </div>
  )
}
