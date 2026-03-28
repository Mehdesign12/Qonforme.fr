"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Users,
  Eye,
  Globe,
  ArrowRight,
  TrendingUp,
  Loader2,
  RefreshCw,
  ExternalLink,
  MousePointerClick,
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
        <span className="ml-3 text-sm text-slate-400">
          Chargement des analytics…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1000px] mx-auto space-y-4">
        <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">
          Analytics
        </h1>
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/80 dark:bg-red-900/10 p-6">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Erreur de chargement
          </p>
          <p className="text-[13px] text-red-500 mt-1">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 rounded-lg bg-red-100 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const convRate =
    data.funnel.landing > 0
      ? ((data.funnel.signupPage / data.funnel.landing) * 100).toFixed(1)
      : "0";
  const fullConvRate =
    data.funnel.landing > 0
      ? ((data.funnel.completed / data.funnel.landing) * 100).toFixed(1)
      : "0";

  const maxPageviews = Math.max(
    ...data.dailyVisitors.map((d) => Number(d.pageviews)),
    1
  );

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight tracking-tight">
            Analytics
          </h1>
          <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-0.5">
            Données PostHog en temps réel
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[#EFF6FF] dark:bg-[#162032] text-[#2563EB] hover:bg-[#DBEAFE] dark:hover:bg-[#1E3A5F] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {/* KPI Cards — Visiteurs */}
      <div>
        <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Visiteurs uniques
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            icon={<Users className="w-4 h-4 text-[#2563EB]" />}
            label="Aujourd'hui"
            value={data.visitors.today}
          />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
            label="7 derniers jours"
            value={data.visitors.week}
          />
          <KpiCard
            icon={<BarChart3 className="w-4 h-4 text-violet-500" />}
            label="30 derniers jours"
            value={data.visitors.month}
          />
        </div>
      </div>

      {/* Funnel de conversion */}
      <div>
        <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Funnel de conversion (30 jours)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FunnelStep
            step="1"
            label="Landing page"
            sublabel="Visiteurs sur /"
            value={data.funnel.landing}
            color="blue"
          />
          <FunnelStep
            step="2"
            label="Page inscription"
            sublabel={`${convRate}% du trafic`}
            value={data.funnel.signupPage}
            color="amber"
          />
          <FunnelStep
            step="3"
            label="Inscription complète"
            sublabel={`${fullConvRate}% conversion`}
            value={data.funnel.completed}
            color="emerald"
          />
        </div>
      </div>

      {/* Graphique visiteurs 14 jours */}
      <div>
        <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Trafic — 14 derniers jours
        </h2>
        <div className="rounded-2xl border p-5 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
          {data.dailyVisitors.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Pas encore de données
            </p>
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {data.dailyVisitors.map((d) => {
                const h = (Number(d.pageviews) / maxPageviews) * 100;
                const date = new Date(d.day);
                const dayLabel = date.toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                });
                return (
                  <div
                    key={d.day}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.pageviews}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-[#2563EB]/80 dark:bg-[#3B82F6]/60 group-hover:bg-[#2563EB] transition-colors min-h-[4px]"
                      style={{ height: `${Math.max(h, 3)}%` }}
                      title={`${dayLabel}: ${d.pageviews} pages vues · ${d.uniques} uniques`}
                    />
                    <span className="text-[9px] text-slate-400 truncate w-full text-center hidden sm:block">
                      {date.toLocaleDateString("fr-FR", { day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]/80" />
              Pages vues
            </span>
            <span>Survolez pour voir les chiffres</span>
          </div>
        </div>
      </div>

      {/* Top pages + Referrers — 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Pages */}
        <div>
          <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            <Eye className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Pages les plus vues (30j)
          </h2>
          <div className="rounded-2xl border bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F] overflow-hidden">
            {data.topPages.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                Pas encore de données
              </p>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
                {data.topPages.map((p, i) => (
                  <div
                    key={p.path}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors"
                  >
                    <span className="w-5 text-center text-[11px] font-bold text-slate-300">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0] truncate">
                        {p.path || "/"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold text-[#0F172A] dark:text-[#E2E8F0]">
                        {Number(p.views).toLocaleString("fr-FR")}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {Number(p.uniques).toLocaleString("fr-FR")} uniques
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sources de trafic */}
        <div>
          <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            <Globe className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Sources de trafic (30j)
          </h2>
          <div className="rounded-2xl border bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F] overflow-hidden">
            {data.topReferrers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                Pas encore de données
              </p>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
                {data.topReferrers.map((r, i) => {
                  let domain = r.referrer;
                  try {
                    domain = new URL(r.referrer).hostname;
                  } catch {
                    /* keep raw */
                  }
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors"
                    >
                      <span className="w-5 text-center text-[11px] font-bold text-slate-300">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0] truncate">
                          {domain}
                        </p>
                      </div>
                      <p className="font-mono text-sm font-bold text-[#0F172A] dark:text-[#E2E8F0] shrink-0">
                        {Number(r.uniques).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lien PostHog */}
      <a
        href="https://us.posthog.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] px-4 py-3 text-sm font-medium text-slate-500 hover:text-[#2563EB] hover:border-[#BFDBFE] dark:hover:border-[#2563EB]/30 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Ouvrir le dashboard complet sur PostHog
      </a>

      <p className="text-[11px] text-slate-300 dark:text-slate-600 flex items-center gap-1.5 pb-4">
        <RefreshCw className="w-3 h-3" />
        Cliquez sur Actualiser pour recharger les données en temps réel.
      </p>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border p-4 bg-white/95 dark:bg-[#0F1E35] border-slate-100 dark:border-[#1E3A5F]">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">
        {Number(value).toLocaleString("fr-FR")}
      </p>
    </div>
  );
}

function FunnelStep({
  step,
  label,
  sublabel,
  value,
  color,
}: {
  step: string;
  label: string;
  sublabel: string;
  value: number;
  color: "blue" | "amber" | "emerald";
}) {
  const colors = {
    blue: {
      bg: "bg-[#EFF6FF] dark:bg-[#162032]",
      ring: "ring-[#BFDBFE] dark:ring-[#2563EB]/30",
      text: "text-[#2563EB]",
      badge: "bg-[#DBEAFE] dark:bg-[#2563EB]/20 text-[#2563EB]",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/10",
      ring: "ring-amber-200 dark:ring-amber-700/30",
      text: "text-amber-600",
      badge: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-900/10",
      ring: "ring-emerald-200 dark:ring-emerald-700/30",
      text: "text-emerald-600",
      badge: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
    },
  };

  const c = colors[color];

  return (
    <div
      className={`relative rounded-2xl border p-4 ${c.bg} border-slate-100 dark:border-[#1E3A5F] ring-1 ${c.ring}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
            color === "blue"
              ? "bg-[#2563EB]"
              : color === "amber"
              ? "bg-amber-500"
              : "bg-emerald-500"
          }`}
        >
          {step}
        </span>
        <span className="text-xs font-semibold text-slate-500">{label}</span>
      </div>
      <p className="font-mono text-2xl font-extrabold text-[#0F172A] dark:text-[#E2E8F0]">
        {Number(value).toLocaleString("fr-FR")}
      </p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>
      {step !== "3" && (
        <ArrowRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-200 dark:text-slate-600 hidden sm:block" />
      )}
    </div>
  );
}

/* ── Types ────────────────────────────────────────────────── */

interface AnalyticsData {
  visitors: { today: number; week: number; month: number };
  topPages: { path: string; views: number; uniques: number }[];
  topReferrers: { referrer: string; uniques: number }[];
  funnel: { landing: number; signupPage: number; completed: number };
  dailyVisitors: { day: string; uniques: number; pageviews: number }[];
}
