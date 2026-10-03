"use client";

import { useEffect, useState } from "react";
import { ChartColumn, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { EmptyState, Kpi, KpiGrid, PageHeader, Panel } from "@/components/app/kit";
import { BarChart, fmtInt, type BarDatum } from "@/components/admin/ui";

const VERCEL_ANALYTICS_URL = "https://vercel.com/mehdesign12s-projects/qonforme-fr/analytics";
const POSTHOG_URL = "https://us.posthog.com";

/** Message lisible pour les erreurs connues de /api/admin/analytics. */
function readableError(message: string): string {
  if (message.includes("POSTHOG_PERSONAL_API_KEY")) {
    return "La clé d'API PostHog (POSTHOG_PERSONAL_API_KEY) n'est pas configurée sur ce déploiement.";
  }
  return message;
}

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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refresh = (
    <button type="button" onClick={fetchData} disabled={loading} className="q-btn q-btn-secondary q-btn-sm">
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      Actualiser
    </button>
  );

  const externalLinks = (
    <Panel title="Tableaux de bord externes" bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-1">
      <p className="text-sm text-[var(--q-text-3)]">
        Signaux web essentiels, pages vues en temps réel et provenance géographique sont consultables chez les fournisseurs.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={POSTHOG_URL} target="_blank" rel="noopener noreferrer" className="q-btn q-btn-secondary q-btn-sm">
          PostHog
          <ExternalLink aria-hidden />
          <span className="sr-only">(nouvel onglet)</span>
        </a>
        <a href={VERCEL_ANALYTICS_URL} target="_blank" rel="noopener noreferrer" className="q-btn q-btn-secondary q-btn-sm">
          Vercel Analytics
          <ExternalLink aria-hidden />
          <span className="sr-only">(nouvel onglet)</span>
        </a>
      </div>
    </Panel>
  );

  const header = <PageHeader title="Audience" subtitle="Visites et inscriptions du site public (PostHog)." actions={refresh} />;

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="q-card grid place-items-center py-24" role="status" aria-label="Chargement des statistiques">
          <Loader2 className="size-6 animate-spin text-[var(--q-accent)]" aria-hidden />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div role="alert" className="q-card">
          <EmptyState
            icon={<ChartColumn className="size-5" aria-hidden />}
            title="Statistiques indisponibles"
            text={error ? readableError(error) : "Aucune donnée reçue."}
            action={<button type="button" onClick={fetchData} className="q-btn q-btn-secondary">Réessayer</button>}
          />
        </div>
        {externalLinks}
      </div>
    );
  }

  const rate = (a: number, b: number) =>
    b > 0 ? `${((a / b) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—";

  const daily: BarDatum[] = data.dailyVisitors.map((d) => {
    const date = new Date(d.day);
    return {
      key: d.day,
      short: date.toLocaleDateString("fr-FR", { day: "numeric" }),
      long: date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
      value: Number(d.pageviews),
      detail: `${fmtInt(Number(d.uniques))} visiteurs uniques`,
    };
  });

  const funnel = [
    { label: "Accueil", sub: "Visiteurs de la page d'accueil", value: data.funnel.landing, rate: null as string | null },
    { label: "Page d'inscription", sub: "du trafic de l'accueil", value: data.funnel.signupPage, rate: rate(data.funnel.signupPage, data.funnel.landing) },
    { label: "Inscription terminée", sub: "du trafic de l'accueil", value: data.funnel.completed, rate: rate(data.funnel.completed, data.funnel.landing) },
  ];

  return (
    <div className="flex flex-col gap-5">
      {header}

      <section aria-labelledby="an-visitors" className="flex flex-col gap-3">
        <h2 id="an-visitors" className="q-h2">Visiteurs uniques</h2>
        <KpiGrid className="sm:!grid-cols-3">
          <Kpi label="Aujourd'hui" value={fmtInt(data.visitors.today)} />
          <Kpi label="7 derniers jours" value={fmtInt(data.visitors.week)} />
          <Kpi label="30 derniers jours" value={fmtInt(data.visitors.month)} className="col-span-2 sm:col-span-1" />
        </KpiGrid>
      </section>

      <section aria-labelledby="an-funnel" className="flex flex-col gap-3">
        <h2 id="an-funnel" className="q-h2">Parcours d&apos;inscription — 30 jours</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {funnel.map((step, i) => (
            <li key={step.label} className="q-card flex flex-col gap-1.5 p-4">
              <span className="flex items-center gap-2 text-[13px] text-[var(--q-text-3)]">
                <span className="grid size-5 place-items-center rounded-full bg-[var(--q-wash)] text-[11px] font-semibold text-[var(--q-accent-strong)]" aria-hidden>
                  {i + 1}
                </span>
                {step.label}
              </span>
              <span className="q-kpi-value">{fmtInt(step.value)}</span>
              <span className="q-kpi-sub">{step.rate ? `${step.rate} ${step.sub}` : step.sub}</span>
            </li>
          ))}
        </ol>
      </section>

      <Panel title="Pages vues — 14 derniers jours" bodyClassName="px-5 pb-5 pt-3">
        <BarChart data={daily} caption="Pages vues par jour" valueName="Pages vues" emptyText="Pas encore de données." />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Pages les plus vues — 30 jours">
          {data.topPages.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--q-text-4)]">Pas encore de données.</p>
          ) : (
            <ol className="q-list border-t border-[var(--q-line-soft)]">
              {data.topPages.map((p, i) => (
                <li key={p.path} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--q-text-4)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[var(--q-ink)]">{p.path || "/"}</span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums text-[var(--q-ink)]">{fmtInt(Number(p.views))}</span>
                    <span className="text-[11px] tabular-nums text-[var(--q-text-4)]">{fmtInt(Number(p.uniques))} uniques</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Sites d'origine — 30 jours">
          {data.topReferrers.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--q-text-4)]">Pas encore de données.</p>
          ) : (
            <ol className="q-list border-t border-[var(--q-line-soft)]">
              {data.topReferrers.map((r, i) => {
                let domain = r.referrer;
                try {
                  domain = new URL(r.referrer).hostname;
                } catch {
                  /* keep raw */
                }
                return (
                  <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--q-text-4)]">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--q-ink)]">{domain}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--q-ink)]">
                      {fmtInt(Number(r.uniques))}
                      <span className="sr-only"> visiteurs uniques</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      {externalLinks}
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
