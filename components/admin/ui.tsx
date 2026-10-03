/**
 * Briques de l'espace admin, au-dessus du kit de l'application
 * (components/app/kit.tsx) : filtres en GET, cartes-filtres, pastilles
 * d'abonnement, état « données indisponibles », graphique en barres CSS.
 *
 * Sans hook ni 'use client' : utilisables dans les pages serveur comme dans
 * les pages client. Couleurs par les jetons --q-* (thème sombre compris).
 */
import Link from 'next/link'
import { Check, Clock, CloudOff, Search, X, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, StatusPill, type Tone } from '@/components/app/kit'
import { PLANS, isPlanId } from '@/lib/stripe/plans'

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

/** Les pages admin sont rendues sur le serveur (UTC) : les heures s'affichent à l'heure de Paris. */
const PARIS = 'Europe/Paris'

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** « 3 oct. 2026 » (ou un autre format), « — » si la date est absente. */
export function fmtDate(
  value: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const d = toDate(value)
  return d ? d.toLocaleDateString('fr-FR', { timeZone: PARIS, ...opts }) : '—'
}

/** « 3 oct. 2026, 14:32 », heure de Paris. */
export function fmtDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value)
  return d
    ? d.toLocaleString('fr-FR', { timeZone: PARIS, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
}

export function fmtInt(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString('fr-FR')
}

export function fmtEuro(n: number, fractionDigits = 0): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtInt(n)} ${n > 1 ? many : one}`
}

/** Nom commercial d'une formule (« starter » → « Essentiel »). */
export function planLabel(plan: string | null | undefined): string {
  if (!plan || plan === 'none') return 'Sans formule'
  return isPlanId(plan) ? PLANS[plan].name : plan
}

export function periodLabel(period: string | null | undefined): string {
  if (period === 'yearly') return 'annuel'
  if (period === 'monthly') return 'mensuel'
  return '—'
}

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

const SUB_STATUS: Record<string, { label: string; tone: Tone; icon?: 'check' | 'clock' | 'x' | 'alert' }> = {
  active:     { label: 'Actif',                tone: 'ok',      icon: 'check' },
  trialing:   { label: 'Essai',                tone: 'info',    icon: 'clock' },
  past_due:   { label: 'Paiement en retard',   tone: 'warn',    icon: 'clock' },
  canceled:   { label: 'Résilié',              tone: 'neutral', icon: 'x' },
  incomplete: { label: 'Paiement incomplet',   tone: 'neutral', icon: 'alert' },
  none:       { label: 'Sans formule',         tone: 'neutral' },
}

const PILL_ICON = {
  check: <Check strokeWidth={2.75} aria-hidden />,
  clock: <Clock strokeWidth={2.25} aria-hidden />,
  x: <X strokeWidth={2.75} aria-hidden />,
  alert: <CircleAlert strokeWidth={2.25} aria-hidden />,
}

export function subscriptionStatusLabel(status: string | null | undefined): string {
  return SUB_STATUS[status ?? 'none']?.label ?? String(status)
}

/** Statut d'un abonnement : libellé et icône, jamais la couleur seule. */
export function SubscriptionPill({ status, className }: { status: string | null | undefined; className?: string }) {
  const def = SUB_STATUS[status ?? 'none'] ?? { label: String(status), tone: 'neutral' as Tone }
  return (
    <StatusPill tone={def.tone} icon={def.icon ? PILL_ICON[def.icon] : undefined} className={className}>
      {def.label}
    </StatusPill>
  )
}

/* ------------------------------------------------------------------ */
/* États                                                               */
/* ------------------------------------------------------------------ */

/**
 * Lecture en échec : à distinguer d'une liste vide (règle « erreur réseau et
 * pas de données » de CLAUDE.md) — sinon une panne passe pour « aucun message ».
 */
export function LoadError({
  what,
  healthLink = true,
  compact,
  className,
  action,
}: {
  /** « les messages », « les abonnements »… */
  what: string
  healthLink?: boolean
  /** Dans une carte existante : une ligne, sans bord ni lien. */
  compact?: boolean
  className?: string
  action?: React.ReactNode
}) {
  if (compact) {
    return (
      <p role="alert" className={cn('flex items-start gap-2 px-5 pb-5 pt-1 text-sm text-[var(--q-danger)]', className)}>
        <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        Impossible de lire {what}. Réessayez dans un instant.
      </p>
    )
  }
  return (
    <div role="alert" className={cn('q-card', className)}>
      <EmptyState
        className="py-10"
        icon={<CloudOff className="size-5" aria-hidden />}
        title="Données indisponibles"
        text={`Impossible de lire ${what} pour le moment. Réessayez dans un instant${healthLink ? ' ; si le problème persiste, consultez la santé du système' : ''}.`}
        action={action ?? (healthLink ? <Link href="/admin/health" className="q-btn q-btn-secondary">Santé du système</Link> : undefined)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Filtres (formulaires GET, rendus côté serveur)                      */
/* ------------------------------------------------------------------ */

export function FilterBar({
  resetHref,
  active,
  children,
  label = 'Filtres',
}: {
  resetHref: string
  active: boolean
  children: React.ReactNode
  label?: string
}) {
  return (
    <form method="GET" role="search" aria-label={label} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
      <div className="flex gap-2">
        <button type="submit" className="q-btn q-btn-secondary flex-1 sm:flex-none">Filtrer</button>
        {active && <Link href={resetHref} className="q-btn q-btn-ghost">Effacer</Link>}
      </div>
    </form>
  )
}

/** Liste déroulante native (16 px sur mobile, règle iOS de CLAUDE.md) avec libellé pour les lecteurs d'écran. */
export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string
  label: string
  defaultValue: string
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex min-w-0 sm:w-auto">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={defaultValue} className="q-input pr-2 sm:w-auto sm:min-w-[170px]">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

export function FilterSearch({
  name = 'q',
  defaultValue,
  placeholder,
  label,
}: {
  name?: string
  defaultValue: string
  placeholder: string
  label: string
}) {
  return (
    <label className="q-fw relative flex h-[42px] min-w-0 items-center gap-2 rounded-[10px] border border-[var(--q-field)] bg-[var(--q-surface)] px-3 sm:min-w-[260px] sm:flex-1">
      <Search className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-full w-full min-w-0 bg-transparent text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-sm"
      />
    </label>
  )
}

/** Carte-indicateur cliquable qui applique un filtre (onglet de résumé). */
export function StatLink({
  label,
  value,
  href,
  active,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  href: string
  active?: boolean
  tone?: 'default' | 'warn' | 'danger'
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'q-kpi rounded-2xl border bg-[var(--q-surface)] !gap-1.5 !p-4 transition-colors hover:border-[var(--q-field)]',
        active ? 'border-[var(--q-accent)] shadow-[0_0_0_3px_var(--q-focus)]' : 'border-[var(--q-line)]',
        tone === 'warn' && !active && 'border-[var(--q-warn-line)]',
        tone === 'danger' && !active && 'border-[var(--q-danger-line)]',
      )}
    >
      <span
        className={cn(
          'text-[13px]',
          tone === 'warn' ? 'font-semibold text-[var(--q-warn)]' : tone === 'danger' ? 'font-semibold text-[var(--q-danger)]' : 'text-[var(--q-text-3)]',
        )}
      >
        {label}
      </span>
      <span className="q-kpi-value !text-[24px]">{value}</span>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Fiche : lignes libellé / valeur                                     */
/* ------------------------------------------------------------------ */

export function InfoList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-[var(--q-line-soft)] px-5">{children}</dl>
}

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === '' || children === false
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-[13px] text-[var(--q-text-4)]">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-[var(--q-ink)] sm:text-right">
        {empty ? <span className="text-[var(--q-placeholder)]">—</span> : children}
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Graphique en barres (une série)                                     */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  key: string
  /** Libellé sous la barre (« oct. », « 3 »). */
  short: string
  /** Libellé complet (bulle, tableau accessible). */
  long: string
  value: number
  /** Période en cours, incomplète : barre plus claire. */
  current?: boolean
  /** Ligne supplémentaire de la bulle (« 12 visiteurs uniques »). */
  detail?: string
}

/** Plafond « rond » de l'axe, au plus près du maximum (204 → 250, 7 → 8). */
function niceTop(max: number): number {
  if (max <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= max) return m * mag
  return 10 * mag
}

/**
 * Barres CSS rendues côté serveur (même dessin que le graphique « Facturé » du
 * tableau de bord) : une seule série en bleu, valeur affichée sur la plus haute
 * et la dernière barre, bulle au survol, tableau pour les lecteurs d'écran.
 */
export function BarChart({
  data,
  caption,
  valueName,
  emptyText = 'Aucune donnée sur cette période.',
  height = 180,
}: {
  data: BarDatum[]
  /** Titre du tableau accessible. */
  caption: string
  /** Nom de la mesure (« Nouveaux abonnés », « Pages vues »). */
  valueName: string
  emptyText?: string
  height?: number
}) {
  const max = Math.max(0, ...data.map((d) => d.value))
  const top = niceTop(max)
  const maxIndex = data.findIndex((d) => d.value === max)
  const cols = { gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }

  return (
    <div>
      {/* pt-5 : place de l'étiquette au-dessus d'une barre qui atteint le haut de l'axe */}
      <div className="flex gap-3 pt-5" aria-hidden>
        <div className="flex w-8 shrink-0 -translate-y-[7px] flex-col justify-between text-right text-xs tabular-nums text-[var(--q-text-4)]" style={{ height }}>
          <span>{fmtInt(top)}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-[var(--q-line-soft)]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--q-line-soft)]" />
          <div className="absolute inset-x-0 bottom-0 border-t border-[var(--q-field)]" />
          <div className="absolute inset-0 grid items-end gap-0.5" style={cols}>
            {data.map((d, i) => {
              const pct = (d.value / top) * 100
              const showValue = d.value > 0 && (i === maxIndex || i === data.length - 1)
              return (
                <div key={d.key} className="group relative flex h-full items-end justify-center">
                  <div className="relative w-[56%] max-w-[36px]" style={{ height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0 }}>
                    <span
                      className={cn(
                        'absolute inset-0 rounded-t-[4px] bg-[var(--q-accent-strong)] transition-[filter] duration-150 group-hover:brightness-110',
                        d.current && 'opacity-40',
                      )}
                    />
                    {/* Étiquette hors du flux : elle ne raccourcit plus la barre qu'elle surmonte */}
                    {showValue && (
                      <span className={cn('absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs tabular-nums', d.current ? 'text-[var(--q-text-4)]' : 'font-semibold text-[var(--q-ink)]')}>
                        {fmtInt(d.value)}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      'q-float pointer-events-none absolute -top-1.5 z-10 hidden w-[170px] flex-col gap-0.5 rounded-xl px-3 py-2 text-xs group-hover:flex',
                      i < data.length / 3 ? 'left-0' : i >= (data.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                    )}
                  >
                    <span className="font-semibold text-[var(--q-ink)]">{d.long}{d.current ? ' (en cours)' : ''}</span>
                    <span className="flex justify-between gap-3 tabular-nums text-[var(--q-text-2)]">
                      <span>{valueName}</span>
                      <span className="font-semibold text-[var(--q-ink)]">{fmtInt(d.value)}</span>
                    </span>
                    {d.detail && <span className="text-[var(--q-text-4)]">{d.detail}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {max === 0 && (
            <p className="absolute inset-0 grid place-items-center text-sm text-[var(--q-text-4)]">{emptyText}</p>
          )}
        </div>
      </div>
      <div className="ml-11 mt-2 grid gap-0.5 text-center text-xs text-[var(--q-text-4)]" style={cols} aria-hidden>
        {data.map((d) => (
          <span key={d.key} className="truncate">{d.short}</span>
        ))}
      </div>
      {/* Enveloppé : un <table> ignore la largeur de 1 px de sr-only et faisait défiler la page en largeur */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Période</th>
              <th scope="col">{valueName}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.long}{d.current ? ' (en cours)' : ''}</th>
                <td>{fmtInt(d.value)}{d.detail ? ` (${d.detail})` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Prospection désactivée                                              */
/* ------------------------------------------------------------------ */

/**
 * En tête des pages Prospects et Campagnes : le démarchage est désactivé par
 * décision (DECISIONS-STRATEGIQUES.md § 3). Les données et les outils restent
 * accessibles, rien n'est supprimé.
 */
export function ProspectingNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div role="note" className="q-banner q-banner-warn">
      <CircleAlert className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">Démarchage désactivé par décision</p>
        <p className="text-[13px] leading-relaxed text-[var(--q-text-2)]">
          Qonforme ne fait ni appel ni email à froid (décisions stratégiques, § 3). Ces données restent consultables et exportables ;
          l&apos;extraction, l&apos;enrichissement et les campagnes ne doivent pas être relancés.
        </p>
        {children}
      </div>
    </div>
  )
}
