"use client"

/**
 * Fenêtre d'un article (calendrier et liste des articles) : ce que l'article
 * devient dans Google, sans quitter l'écran.
 *
 * - En-tête : couverture, titre, statut, type, source, date à l'heure de
 *   Paris, adresse à copier ;
 * - « Performances dans Google » : clics, impressions, taux de clic, position
 *   (28 derniers jours ou depuis la publication), courbe jour par jour ;
 * - « Mots-clés » : mot-clé principal (volume, difficulté, position de
 *   l'article) et recherches qui affichent l'article ;
 * - « Qualité » : score de référencement du texte actuel et points à revoir ;
 * - pied : voir sur le site, publier, repasser en brouillon ou replanifier,
 *   et « Modifier l'article ».
 *
 * Ordinateur : fenêtre de 920 px, corps qui défile, pied collant. Téléphone :
 * plein écran, voile sans flou (règle backdrop-filter de CLAUDE.md), pied
 * au-dessus de la zone de sécurité. Chaque état est dessiné : chargement
 * (squelette fidèle), erreur (« Réessayer »), Search Console non reliée ou
 * illisible, article hors ligne, article publié que Google n'a pas encore
 * affiché.
 *
 * Données : GET /api/admin/seo/articles/posts/<id> (lib/seo/articles/details.ts).
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowUpRight,
  CalendarClock,
  ChartNoAxesColumn,
  CircleCheck,
  CircleX,
  Clock,
  CloudOff,
  Copy,
  Eye,
  EyeOff,
  FileWarning,
  Gauge,
  Hash,
  ImageIcon,
  KeyRound,
  Loader2,
  MousePointerClick,
  Percent,
  PencilLine,
  Plug,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  TriangleAlert,
  Undo2,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StatusPill, type Tone } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { fmtCount, fmtDay, fmtPosition, fmtRange, fmtRate, NBSP } from "@/lib/seo/format"
import { scoreTone } from "@/lib/seo/articles/onpage"
import { ARTICLE_SOURCE_LABELS } from "@/lib/seo/articles/status"
import { parisDayTime, parisInstant, weekdayOf } from "@/lib/seo/articles/schedule"
import { addDays, todayInParis } from "@/lib/utils/paris-date"
import { canonicalKeyword, foldAccents } from "@/lib/seo/keywords/normalize"
import type { ArticleDetailsPayload } from "@/lib/seo/articles/details"
import type { EditorKeyword, GscTotalsLite, PageQuery } from "@/lib/seo/articles/editor-types"
import { api } from "@/components/admin/seo/articles/api"
import { ArticleStatusPill, Tag, TypeTag } from "@/components/admin/seo/articles/pills"

/* ------------------------------------------------------------------ */
/* Formats (exportés pour les tests)                                   */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

/** « mardi 21 octobre », « Mercredi 1er octobre 2026 » (jour AAAA-MM-JJ). */
export function longDay(day: string, opts: { year?: boolean; capitalize?: boolean } = {}): string {
  const [y, m, d] = day.split("-").map(Number)
  const text = `${WEEKDAYS[weekdayOf(day) - 1]} ${d === 1 ? "1er" : d}${NBSP}${MONTHS[m - 1]}${opts.year ? ` ${y}` : ""}`
  return opts.capitalize ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text
}

/** « mardi 7 octobre 2026 à 21:19 » (heure de Paris). */
export function longDateTime(iso: string): string {
  const { day, time } = parisDayTime(iso)
  return `${longDay(day, { year: true })} à ${time}`
}

type DetailsPost = ArticleDetailsPayload["post"]

/**
 * Ligne de date de l'en-tête : publication, programmation (ou date prévue
 * d'un article retenu par le contrôle à son heure), sinon création.
 */
export function articleDateLine(post: Pick<DetailsPost, "status" | "publishedAt" | "scheduledAt" | "createdAt">): { text: string; iso: string } | null {
  if (post.status === "published" && post.publishedAt) return { text: `Publié le ${longDateTime(post.publishedAt)}`, iso: post.publishedAt }
  if (post.status === "scheduled" && post.scheduledAt) return { text: `Programmé pour le ${longDateTime(post.scheduledAt)}`, iso: post.scheduledAt }
  if (post.status === "to_review" && post.scheduledAt) return { text: `Prévu le ${longDateTime(post.scheduledAt)}`, iso: post.scheduledAt }
  if (post.createdAt) return { text: `Créé le ${longDateTime(post.createdAt)}`, iso: post.createdAt }
  return null
}

/** Difficulté DataForSEO (0 à 100) : Facile sous 30, Moyenne sous 60, sinon Difficile. */
export function difficultyOf(value: number | null): { label: string; tone: Tone } | null {
  if (value === null || !Number.isFinite(value)) return null
  if (value < 30) return { label: "Facile", tone: "ok" }
  if (value < 60) return { label: "Moyenne", tone: "warn" }
  return { label: "Difficile", tone: "danger" }
}

/** Appréciation d'un score (mêmes seuils que la couleur). */
export function scoreVerdict(score: number): string {
  const tone = scoreTone(score)
  return tone === "ok" ? "Bon" : tone === "warn" ? "À améliorer" : "Insuffisant"
}

const SITE_HOST = "qonforme.fr"
const nf = (n: number) => n.toLocaleString("fr-FR")
const plural = (n: number, one: string, many: string) => `${nf(n)}${NBSP}${n > 1 ? many : one}`
/** Adresse d'image affichable (http(s) ou chemin du site) ; sinon rien. */
const safeImage = (url: string | null) => (url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null)

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

function SectionTitle({ id, icon, children, aside }: { id: string; icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
      <h3 id={id} className="m-0 flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--q-ink)]">
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-[var(--q-wash)] text-[var(--q-accent-strong)] [&_svg]:size-4">
          {icon}
        </span>
        {children}
      </h3>
      {aside}
    </div>
  )
}

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-lg bg-[var(--q-sunken)] motion-reduce:animate-none", className)} />
}

/** Bandeau d'état d'une section (non reliée, illisible, hors ligne…). */
function Notice({ tone = "info", icon, children, action }: { tone?: "info" | "warn"; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("q-banner !text-[13px] leading-relaxed", tone === "warn" && "q-banner-warn")}>
      <span aria-hidden className="mt-0.5 shrink-0 [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* En-tête                                                             */
/* ------------------------------------------------------------------ */

function CoverThumb({ url, alt }: { url: string | null; alt: string | null }) {
  const [broken, setBroken] = useState(false)
  const src = safeImage(url)
  useEffect(() => setBroken(false), [src])
  if (!src || broken) {
    return (
      <div
        className="grid aspect-video w-44 shrink-0 place-items-center rounded-xl border border-dashed border-[var(--q-line)] bg-[var(--q-surface-2)] text-[var(--q-text-4)] max-sm:hidden"
        role="img"
        aria-label={src ? "Image de couverture introuvable" : "Sans image de couverture"}
      >
        <span className="flex flex-col items-center gap-1.5 text-[11.5px] font-medium">
          <ImageIcon className="size-5" aria-hidden />
          {src ? "Image introuvable" : "Sans couverture"}
        </span>
      </div>
    )
  }
  return (
    <div className="relative aspect-video w-44 shrink-0 overflow-hidden rounded-xl border border-[var(--q-line)] bg-[var(--q-sunken)] max-sm:w-full">
      {/* Couverture du blog ou adresse externe : <img> simple, sans passer par l'optimiseur */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
    </div>
  )
}

export function DetailsHeader({ post, title }: { post: DetailsPost; title: React.ReactNode }) {
  const date = articleDateLine(post)
  const address = `${SITE_HOST}/blog/${post.slug}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${address}`)
      toast.success("Adresse copiée")
    } catch {
      toast.error("Copie impossible : sélectionnez l'adresse à la main.")
    }
  }

  const pills = (
    <>
      <ArticleStatusPill status={post.status} post />
      <TypeTag type={post.type} />
      <Tag>{ARTICLE_SOURCE_LABELS[post.source]}</Tag>
    </>
  )

  return (
    <div className="flex gap-5 max-sm:flex-col max-sm:gap-4">
      {/* Téléphone : les pastilles d'abord, à côté du bouton de fermeture, puis la couverture pleine largeur */}
      <div className="flex min-h-[34px] flex-wrap items-center gap-1.5 pr-10 sm:hidden">{pills}</div>
      <CoverThumb url={post.coverUrl} alt={post.coverAlt ?? post.title} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 max-sm:hidden">{pills}</div>
        {title}
        <div className="flex flex-col gap-1.5">
          {date && (
            <p className="m-0 flex items-start gap-1.5 text-[13px] leading-snug text-[var(--q-text-3)]">
              <CalendarClock className="mt-px size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
              <time dateTime={date.iso}>{date.text}</time>
            </p>
          )}
          {post.status === "to_review" && post.heldReason && (
            <p className="m-0 flex items-start gap-1.5 text-[13px] leading-snug text-[var(--q-warn)]">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>Retenu : {post.heldReason}</span>
            </p>
          )}
          <div className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 truncate font-mono text-[12.5px] text-[var(--q-text-2)]" title={`https://${address}`}>
              {address}
            </span>
            <button
              type="button"
              onClick={copy}
              className="q-btn q-btn-ghost q-btn-sm !h-7 shrink-0 !gap-1.5 !px-2 !text-[12px] max-md:!h-11 max-md:!px-3"
              aria-label={`Copier l'adresse ${address}`}
            >
              <Copy className="!size-3.5" aria-hidden />
              Copier
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Courbe jour par jour                                                */
/* ------------------------------------------------------------------ */

type DayPoint = { day: string; clicks: number; impressions: number }

/** Plafond « rond » d'un axe (7 → 8, 204 → 250, 0 → 1). */
export function niceCeil(max: number): number {
  if (max <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= max) return m * mag
  return 10 * mag
}

const IMPRESSIONS_H = 92
const CLICKS_H = 60
/** Marge haute de chaque graphique (la valeur haute de l'axe ne touche pas le titre). */
const PLOT_TOP = 6
const fmtTick = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${NBSP}k` : n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }))
const weekday = (day: string) => ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."][weekdayOf(day) - 1]

function AxisTicks({ top, height }: { top: number; height: number }) {
  return (
    <>
      <span className="absolute inset-x-0 border-t border-[var(--q-line-soft)]" style={{ top: PLOT_TOP }} />
      <span className="absolute inset-x-0 bottom-0 border-t border-[var(--q-line)]" />
      <span className="absolute right-[calc(100%+8px)] -translate-y-1/2 text-[11px] leading-none tabular-nums text-[var(--q-text-4)]" style={{ top: PLOT_TOP }}>
        {fmtTick(top)}
      </span>
      <span className="absolute right-[calc(100%+8px)] -translate-y-1/2 text-[11px] leading-none tabular-nums text-[var(--q-text-4)]" style={{ top: height }}>
        0
      </span>
    </>
  )
}

/**
 * Impressions (barres) et clics (courbe) jour par jour, en deux graphiques
 * superposés qui partagent l'axe des jours : jamais deux échelles sur un même
 * graphique (l'alignement de deux axes inventerait une corrélation). Positions
 * en pourcentage : le rendu suit la largeur sans mesure ni rendu différent
 * entre serveur et navigateur. Survol ou flèches du clavier : réticule commun
 * et bulle des deux valeurs ; tableau équivalent pour les lecteurs d'écran.
 */
export function ArticleTrendChart({ series }: { series: DayPoint[] }) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const [announce, setAnnounce] = useState("")
  const n = series.length
  if (n === 0) return null

  const pct = (i: number) => ((i + 0.5) / n) * 100
  const impTop = niceCeil(Math.max(...series.map((d) => d.impressions)))
  const clkTop = niceCeil(Math.max(...series.map((d) => d.clicks)))
  const barH = (v: number) => (v / impTop) * (IMPRESSIONS_H - PLOT_TOP)
  const yClk = (v: number) => PLOT_TOP + (1 - v / clkTop) * (CLICKS_H - PLOT_TOP - 2)
  // Courbe dans un repère de 1 000 de large, étiré à la largeur (trait d'épaisseur constante)
  const x1000 = (i: number) => ((i + 0.5) / n) * 1000
  const line = series.map((d, i) => `${i ? "L" : "M"}${x1000(i).toFixed(1)} ${yClk(d.clicks).toFixed(1)}`).join(" ")
  const area = `${line} L${x1000(n - 1).toFixed(1)} ${CLICKS_H} L${x1000(0).toFixed(1)} ${CLICKS_H} Z`
  // Jours repères : 6 au plus sur ordinateur, 4 sur téléphone (jamais deux étiquettes qui se touchent)
  const tickSet = (count: number) => {
    const every = Math.max(1, Math.ceil(n / count))
    return new Set(series.map((_, i) => i).filter((i) => (i % every === 0 && n - 1 - i >= every * 0.6) || i === n - 1))
  }
  const wide = tickSet(6)
  const narrow = tickSet(4)
  const ticks = series.map((d, i) => ({ d, i, wide: wide.has(i), narrow: narrow.has(i) })).filter((t) => t.wide || t.narrow)

  const pick = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    setActive(Math.max(0, Math.min(n - 1, Math.floor(((clientX - rect.left) / rect.width) * n))))
  }
  const say = (i: number) => {
    const d = series[i]
    setAnnounce(`${weekday(d.day)} ${fmtDay(d.day)} : ${plural(d.impressions, "impression", "impressions")}, ${plural(d.clicks, "clic", "clics")}`)
  }
  const onKey = (e: React.KeyboardEvent) => {
    const keys: Record<string, (i: number) => number> = { ArrowLeft: (i) => i - 1, ArrowRight: (i) => i + 1, Home: () => 0, End: () => n - 1 }
    if (e.key === "Escape") {
      setActive(null)
      return
    }
    const move = keys[e.key]
    if (!move) return
    e.preventDefault()
    const next = Math.max(0, Math.min(n - 1, move(active ?? n - 1)))
    setActive(next)
    say(next)
  }

  const cur = active !== null ? series[active] : null
  const dot = active ?? n - 1
  const crosshair = (h: number) =>
    cur ? <span aria-hidden className="pointer-events-none absolute top-0 w-px -translate-x-1/2 bg-[var(--q-text-4)] opacity-45" style={{ left: `${pct(active as number)}%`, height: h }} /> : null

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        tabIndex={0}
        role="group"
        aria-label="Impressions et clics par jour. Flèches gauche et droite pour parcourir les jours."
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        // Au doigt, la bulle reste après le toucher (elle part quand le graphique perd le focus)
        onPointerLeave={(e) => e.pointerType !== "touch" && setActive(null)}
        onFocus={() => {
          if (active !== null) return
          setActive(n - 1)
          say(n - 1)
        }}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
        className="relative touch-pan-y select-none rounded-lg py-1 outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)]"
      >
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        <div ref={plotRef} aria-hidden className="relative ml-[38px] mr-2.5">
          {/* Impressions : barres fines, extrémité arrondie, base carrée sur l'axe */}
          <p className="m-0 flex items-center gap-1.5 pb-1.5 text-[12px] font-medium text-[var(--q-text-3)]">
            <span className="inline-block h-2.5 w-2 rounded-[2px] bg-[var(--q-accent)] opacity-60" />
            Impressions
          </p>
          <div className="relative" style={{ height: IMPRESSIONS_H }}>
            <AxisTicks top={impTop} height={IMPRESSIONS_H} />
            {series.map((d, i) =>
              d.impressions > 0 ? (
                <span
                  key={d.day}
                  className="absolute bottom-0 -translate-x-1/2 rounded-t-[4px] bg-[var(--q-accent)] transition-opacity duration-100 motion-reduce:transition-none"
                  style={{
                    left: `${pct(i)}%`,
                    // Barre fine : 62 % de la place d'un jour, 16 px au plus (le reste est de l'air)
                    width: `${(62 / n).toFixed(3)}%`,
                    maxWidth: 16,
                    height: Math.max(1, barH(d.impressions)),
                    opacity: active === null ? 0.6 : active === i ? 1 : 0.32,
                  }}
                />
              ) : null,
            )}
            {crosshair(IMPRESSIONS_H)}
          </div>

          {/* Clics : courbe de 2 px, aire à 10 %, point au dernier jour (ou au jour survolé) */}
          <p className="m-0 flex items-center gap-1.5 pb-1.5 pt-3.5 text-[12px] font-medium text-[var(--q-text-3)]">
            <span className="inline-block h-0.5 w-3 rounded-full bg-[var(--q-accent-strong)]" />
            Clics
          </p>
          <div className="relative" style={{ height: CLICKS_H }}>
            <AxisTicks top={clkTop} height={CLICKS_H} />
            <svg viewBox={`0 0 1000 ${CLICKS_H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <path d={area} fill="var(--q-accent)" fillOpacity={0.1} />
              <path d={line} fill="none" stroke="var(--q-accent-strong)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {crosshair(CLICKS_H)}
            <span
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--q-surface)] bg-[var(--q-accent-strong)]"
              style={{ left: `${pct(dot)}%`, top: yClk(series[dot].clicks) }}
            />
          </div>

          {/* Jours */}
          <div className="relative mt-2 h-4 text-[11px] tabular-nums text-[var(--q-text-4)]">
            {ticks.map(({ d, i, wide: onWide, narrow: onNarrow }) => (
              <span
                key={d.day}
                className={cn(
                  "absolute whitespace-nowrap",
                  i === 0 ? "left-0" : i === n - 1 ? "right-0" : "-translate-x-1/2",
                  !onWide && "sm:hidden",
                  !onNarrow && "max-sm:hidden",
                )}
                style={i === 0 || i === n - 1 ? undefined : { left: `${pct(i)}%` }}
              >
                {fmtDay(d.day)}
              </span>
            ))}
          </div>

          {/* Bulle : la valeur d'abord, le nom de la série ensuite */}
          {cur && (
            <div
              className="pointer-events-none absolute top-6 z-10 w-[160px] rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] px-3 py-2.5 [box-shadow:var(--q-shadow-pop)]"
              style={{ left: `clamp(0px, calc(${pct(active as number)}% - 80px), calc(100% - 160px))` }}
            >
              <p className="m-0 text-[11.5px] font-medium text-[var(--q-text-4)]">
                {weekday(cur.day)} {fmtDay(cur.day)}
              </p>
              <p className="m-0 mt-1 flex items-center gap-2 text-[12.5px] text-[var(--q-text-3)]">
                <span className="inline-block h-2.5 w-2 shrink-0 rounded-[2px] bg-[var(--q-accent)] opacity-60" />
                <span className="q-num font-semibold text-[var(--q-ink)]">{nf(cur.impressions)}</span>
                {cur.impressions > 1 ? "impressions" : "impression"}
              </p>
              <p className="m-0 mt-0.5 flex items-center gap-2 text-[12.5px] text-[var(--q-text-3)]">
                <span className="inline-block h-0.5 w-2 shrink-0 rounded-full bg-[var(--q-accent-strong)]" />
                <span className="q-num font-semibold text-[var(--q-ink)]">{nf(cur.clicks)}</span>
                {cur.clicks > 1 ? "clics" : "clic"}
              </p>
            </div>
          )}
        </div>
      </div>

      <figcaption className="text-[12px] text-[var(--q-text-4)]">Par jour · {fmtRange(series[0].day, series[n - 1].day)}</figcaption>

      <table className="sr-only">
        <caption>
          Impressions et clics de l&apos;article par jour, du {fmtDay(series[0].day, true)} au {fmtDay(series[n - 1].day, true)}
        </caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">Impressions</th>
            <th scope="col">Clics</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <th scope="row">{fmtDay(d.day, true)}</th>
              <td>{nf(d.impressions)}</td>
              <td>{nf(d.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* Performances                                                        */
/* ------------------------------------------------------------------ */

export type PerformancePeriod = "28d" | "since"

function MetricTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--q-text-3)] [&_svg]:size-3.5 [&_svg]:text-[var(--q-text-4)]">
        {icon}
        {label}
      </dt>
      <dd className="m-0 flex flex-col gap-0.5">
        <span className="q-num text-[22px] font-semibold leading-none tracking-[-0.02em] text-[var(--q-ink)] tabular-nums">{value}</span>
        {sub && <span className="text-[11.5px] text-[var(--q-text-4)]">{sub}</span>}
      </dd>
    </div>
  )
}

function MetricTiles({ totals, label }: { totals: GscTotalsLite; label: string }) {
  return (
    <div>
      <p className="sr-only">{label}</p>
      <dl className="m-0 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <MetricTile icon={<MousePointerClick aria-hidden />} label="Clics" value={fmtCount(totals.clicks)} />
        <MetricTile icon={<Eye aria-hidden />} label="Impressions" value={fmtCount(totals.impressions)} />
        <MetricTile icon={<Percent aria-hidden />} label="Taux de clic" value={fmtRate(totals.ctr)} />
        <MetricTile icon={<Hash aria-hidden />} label="Position moyenne" value={fmtPosition(totals.position)} sub={totals.position !== null ? "1 = premier résultat" : undefined} />
      </dl>
    </div>
  )
}

function PerformanceSection({
  details,
  period,
  onPeriodChange,
  onRetry,
}: {
  details: ArticleDetailsPayload
  period: PerformancePeriod
  onPeriodChange: (p: PerformancePeriod) => void
  onRetry: () => void
}) {
  const id = useId()
  const { performance: perf, post } = details
  const published = post.status === "published"
  const sinceAvailable = perf.sincePublished !== null
  const active: PerformancePeriod = period === "since" && sinceAvailable ? "since" : "28d"
  const totals = active === "since" && perf.sincePublished ? perf.sincePublished : perf.last28
  const seriesHasData = perf.series.some((d) => d.impressions > 0)
  const hasData = perf.last28.impressions > 0 || (perf.sincePublished?.impressions ?? 0) > 0 || seriesHasData || perf.queries.length > 0

  const seg = (
    <div role="group" aria-label="Période des performances" className="q-seg max-sm:flex max-sm:w-full">
      <button type="button" aria-pressed={active === "28d"} onClick={() => onPeriodChange("28d")} className="max-sm:flex-1 max-md:!h-11">
        28 derniers jours
      </button>
      <button
        type="button"
        aria-pressed={active === "since"}
        onClick={() => onPeriodChange("since")}
        disabled={!sinceAvailable}
        title={sinceAvailable ? undefined : "L'article n'est pas en ligne."}
        className="max-sm:flex-1 max-md:!h-11 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Depuis la publication
      </button>
    </div>
  )

  let body: React.ReactNode
  if (perf.error) {
    body = (
      <Notice
        tone="warn"
        icon={<CloudOff />}
        action={
          <button type="button" onClick={onRetry} className="q-btn q-btn-secondary q-btn-sm max-md:q-btn-lg">
            <RotateCcw aria-hidden />
            Réessayer
          </button>
        }
      >
        <p className="m-0 font-semibold">Performances indisponibles</p>
        <p className="m-0 text-[var(--q-text-2)]">{perf.error}</p>
      </Notice>
    )
  } else if (!perf.connected) {
    body = (
      <Notice
        icon={<Plug />}
        action={
          <Link href="/admin/seo/parametres/connexions" className="q-btn q-btn-secondary q-btn-sm max-md:q-btn-lg">
            Paramètres › Connexions
          </Link>
        }
      >
        {/* Aucune donnée enregistrée : connexion absente, ou reliée mais pas encore lue (les deux cas sont dits) */}
        <p className="m-0 font-semibold">Search Console n&apos;a encore rien transmis</p>
        <p className="m-0 text-[var(--q-text-2)]">
          Reliez-la pour voir les clics, les impressions et la position de chaque article. Déjà reliée : les chiffres arrivent avec sa première mise à jour quotidienne.
        </p>
      </Notice>
    )
  } else if (!published && !hasData) {
    body = (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-4">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--q-surface)] text-[var(--q-text-3)] shadow-[0_1px_2px_rgba(10,17,34,.06)]">
          {post.status === "scheduled" ? <Clock className="size-4" /> : <EyeOff className="size-4" />}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
          <p className="m-0 font-semibold text-[var(--q-ink)]">{post.status === "scheduled" ? "Pas encore en ligne" : "Article hors ligne"}</p>
          <p className="m-0 text-[var(--q-text-3)]">
            {post.status === "scheduled"
              ? "Les performances apparaîtront quelques jours après la publication : Google doit d'abord découvrir la page."
              : "Les performances apparaîtront une fois l'article publié et découvert par Google."}
          </p>
        </div>
      </div>
    )
  } else {
    body = (
      <>
        {!hasData && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] text-[var(--q-text-2)]">
            <Clock className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            <p className="m-0">Google n&apos;a pas encore affiché cet article : une nouvelle page met souvent plusieurs jours à apparaître.</p>
          </div>
        )}
        {!published && hasData && (
          <p className="m-0 flex items-start gap-2 text-[13px] text-[var(--q-text-3)]">
            <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Article hors ligne : ces chiffres datent de sa période en ligne.
          </p>
        )}
        <MetricTiles totals={totals} label={active === "since" ? "Performances depuis la publication" : "Performances des 28 derniers jours"} />
        {seriesHasData ? (
          <div className="rounded-xl border border-[var(--q-line)] bg-[var(--q-surface)] px-3 pb-3 pt-3.5 sm:px-4">
            <ArticleTrendChart series={perf.series} />
          </div>
        ) : (
          // Des recherches plus anciennes existent, mais aucune impression sur la période de la courbe : pas de courbe plate
          hasData &&
          perf.series.length > 0 && (
            <p className="m-0 flex items-start gap-2 rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] text-[var(--q-text-3)]">
              <ChartNoAxesColumn className="mt-0.5 size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
              Aucun affichage dans Google du {fmtDay(perf.series[0].day)} au {fmtDay(perf.series[perf.series.length - 1].day)}.
            </p>
          )
        )}
      </>
    )
  }

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <SectionTitle id={id} icon={<ChartNoAxesColumn />} aside={perf.connected && !perf.error && (published || hasData) ? seg : undefined}>
        Performances dans Google
      </SectionTitle>
      {body}
      {/* Note de fraîcheur seulement quand des chiffres sont affichés (rien à dater pour un article jamais en ligne) */}
      {perf.connected && perf.lastDate && !perf.error && (published || hasData) && (
        <p className="m-0 flex items-center gap-1.5 text-[12px] text-[var(--q-text-4)]">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          Données Search Console jusqu&apos;au {fmtDay(perf.lastDate)} (2 à 3 jours de décalage).
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Mots-clés                                                           */
/* ------------------------------------------------------------------ */

function Chip({ icon, children, className }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--q-line)] bg-[var(--q-surface)] px-2.5 text-[12.5px] font-medium text-[var(--q-text-2)] [&_svg]:size-3.5 [&_svg]:text-[var(--q-text-4)]",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

function MainKeyword({ keyword, connected, postId }: { keyword: EditorKeyword | null; connected: boolean; postId: string }) {
  if (!keyword) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 flex items-start gap-2 text-[13px] text-[var(--q-text-2)]">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
          Aucun mot-clé principal : choisissez-le dans l&apos;éditeur.
        </p>
        <Link href={`/admin/blog/${postId}`} className="q-link inline-flex min-h-11 shrink-0 items-center gap-1 text-[13px] md:min-h-0">
          Choisir le mot-clé
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    )
  }
  const difficulty = difficultyOf(keyword.difficulty)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--q-text-4)]">Mot-clé principal</span>
        {keyword.fromPlan && (
          <span className="inline-flex h-5 items-center rounded-full bg-[var(--q-wash)] px-2 text-[11px] font-semibold text-[var(--q-accent-strong)]">Plan d&apos;octobre</span>
        )}
      </div>
      <p className="m-0 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[var(--q-ink)] [overflow-wrap:anywhere]">{keyword.keyword}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip icon={<Search aria-hidden />}>
          {keyword.volume !== null ? (
            <span>
              <span className="q-num font-semibold text-[var(--q-ink)]">{nf(keyword.volume)}</span>
              {NBSP}recherches/mois
            </span>
          ) : (
            "Volume inconnu"
          )}
        </Chip>
        <Chip>
          Difficulté
          {difficulty ? (
            <StatusPill tone={difficulty.tone} className="-mr-1 !h-5 !px-2 !text-[11px]">
              {difficulty.label}
            </StatusPill>
          ) : (
            <>
              <span aria-hidden className="text-[var(--q-text-4)]">—</span>
              <span className="sr-only">inconnue</span>
            </>
          )}
        </Chip>
        <Chip icon={<Hash aria-hidden />}>
          {!connected ? (
            <>
              Position
              <span aria-hidden className="text-[var(--q-text-4)]">—</span>
              <span className="sr-only">inconnue (Search Console non reliée)</span>
            </>
          ) : keyword.position !== null ? (
            <span>
              Position <span className="q-num font-semibold text-[var(--q-ink)]">{fmtPosition(keyword.position)}</span>
            </span>
          ) : (
            "Pas encore classé"
          )}
        </Chip>
      </div>
    </div>
  )
}

function QueriesTable({ queries, keyword, period }: { queries: PageQuery[]; keyword: string | null; period: string }) {
  const max = Math.max(1, ...queries.map((q) => q.impressions))
  // Même rapprochement que le serveur (keywordMatchKey) : accents, casse, apostrophes et espaces
  const fold = (s: string) => foldAccents(canonicalKeyword(s))
  const isMain = (q: string) => keyword !== null && fold(q) === fold(keyword)
  const bar = (n: number) => (
    <span aria-hidden className="block h-1.5 w-full max-w-16 overflow-hidden rounded-full bg-[var(--q-line-soft)]">
      <span className="block h-full rounded-full bg-[var(--q-accent)]" style={{ width: `${Math.max(4, Math.round((n / max) * 100))}%` }} />
    </span>
  )
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-[var(--q-line)] sm:block">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">Recherches qui affichent l&apos;article, {period}</caption>
          <thead>
            <tr className="bg-[var(--q-surface-2)] text-left text-[11.5px] font-medium text-[var(--q-text-4)]">
              <th scope="col" className="px-3.5 py-2 font-medium">Requête</th>
              <th scope="col" className="w-[124px] px-3 py-2 text-right font-medium">Impressions</th>
              <th scope="col" className="w-[64px] px-3 py-2 text-right font-medium">Clics</th>
              <th scope="col" className="w-[76px] px-3.5 py-2 text-right font-medium">Position</th>
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => (
              <tr key={q.query} className={cn("border-t border-[var(--q-line-soft)]", isMain(q.query) && "bg-[var(--q-wash)]")}>
                <th scope="row" className="px-3.5 py-2.5 text-left font-medium text-[var(--q-ink)]">
                  <span className="flex flex-col gap-0.5">
                    <span className="break-words">{q.query}</span>
                    {isMain(q.query) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--q-accent-strong)]">
                        <KeyRound className="size-3" aria-hidden />
                        Mot-clé principal
                      </span>
                    )}
                  </span>
                </th>
                <td className="px-3 py-2.5">
                  <span className="flex items-center justify-end gap-2.5">
                    {bar(q.impressions)}
                    <span className="q-num w-10 text-right tabular-nums text-[var(--q-text-2)]">{fmtCount(q.impressions)}</span>
                  </span>
                </td>
                <td className="q-num px-3 py-2.5 text-right tabular-nums text-[var(--q-text-2)]">{fmtCount(q.clicks)}</td>
                <td className="q-num px-3.5 py-2.5 text-right tabular-nums text-[var(--q-text-2)]">{fmtPosition(q.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-[var(--q-line-soft)] rounded-xl border border-[var(--q-line)] p-0 sm:hidden" aria-label={`Recherches qui affichent l'article, ${period}`}>
        {queries.map((q) => (
          <li key={q.query} className={cn("flex flex-col gap-2 px-3.5 py-3", isMain(q.query) && "bg-[var(--q-wash)]")}>
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words text-[14px] font-medium leading-snug text-[var(--q-ink)]">{q.query}</span>
              {isMain(q.query) && <KeyRound className="mt-0.5 size-3.5 shrink-0 text-[var(--q-accent-strong)]" aria-label="Mot-clé principal" />}
            </span>
            <span className="flex items-center gap-3 text-[12.5px] text-[var(--q-text-3)]">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {bar(q.impressions)}
                <span className="q-num whitespace-nowrap tabular-nums">{plural(q.impressions, "impression", "impressions")}</span>
              </span>
              <span className="q-num whitespace-nowrap tabular-nums">{plural(q.clicks, "clic", "clics")}</span>
              <span className="q-num whitespace-nowrap tabular-nums">Pos.{NBSP}{fmtPosition(q.position)}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function KeywordsSection({ details }: { details: ArticleDetailsPayload }) {
  const id = useId()
  const { performance: perf, post, keyword } = details
  const connected = perf.connected && !perf.error
  // Requêtes : 90 jours, ou depuis la publication si elle est plus récente
  const published = post.status === "published" && post.publishedAt ? parisDayTime(post.publishedAt).day : null
  const period = perf.lastDate && published && published > addDays(perf.lastDate, -89) ? "depuis la publication" : "sur 90 jours"
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <SectionTitle id={id} icon={<KeyRound />}>
        Mots-clés
      </SectionTitle>
      <MainKeyword keyword={keyword} connected={connected} postId={post.id} />
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h4 className="m-0 text-[13px] font-semibold text-[var(--q-ink)]">Recherches qui affichent l&apos;article</h4>
          {connected && perf.queries.length > 0 && <span className="text-[12px] text-[var(--q-text-4)]">{period}</span>}
        </div>
        {!connected ? (
          <p className="m-0 text-[13px] text-[var(--q-text-3)]">
            {perf.error ? "Recherches indisponibles pour le moment." : "Reliez Search Console pour voir les recherches qui affichent l'article."}
          </p>
        ) : perf.queries.length === 0 ? (
          <p className="m-0 flex items-start gap-2 rounded-xl bg-[var(--q-surface-2)] px-3.5 py-3 text-[13px] text-[var(--q-text-3)]">
            <Search className="mt-0.5 size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            {post.status === "published"
              ? "Aucune recherche ne l'a encore affiché dans Google. Les premières requêtes arrivent en général après quelques jours."
              : "Aucune recherche : l'article n'est pas en ligne."}
          </p>
        ) : (
          <QueriesTable queries={perf.queries} keyword={keyword?.keyword ?? null} period={period} />
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Qualité                                                             */
/* ------------------------------------------------------------------ */

const RING: Record<"ok" | "warn" | "danger", string> = { ok: "var(--q-ok)", warn: "var(--q-warn)", danger: "var(--q-danger)" }

function ScoreRing({ score }: { score: number }) {
  const size = 76
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const value = Math.max(0, Math.min(100, Math.round(score)))
  const tone = scoreTone(value)
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`Score de référencement : ${value} sur 100, ${scoreVerdict(value).toLowerCase()}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--q-line-soft)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING[tone]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span aria-hidden className="absolute flex flex-col items-center leading-none">
        <span className="q-num text-[22px] font-semibold tracking-[-0.02em] text-[var(--q-ink)] tabular-nums">{value}</span>
        <span className="mt-0.5 text-[10.5px] font-medium text-[var(--q-text-4)]">/100</span>
      </span>
    </span>
  )
}

function QualitySection({ details }: { details: ArticleDetailsPayload }) {
  const id = useId()
  const { quality: q, post } = details
  const tone = scoreTone(q.score)
  const figures: { label: string; value: string }[] = [
    { label: "Mots", value: nf(q.words) },
    { label: "Lecture", value: `${nf(q.readingMinutes)}${NBSP}min` },
    { label: "Sous-titres (H2)", value: nf(q.h2) },
    { label: "Liens internes", value: nf(q.internalLinks) },
    { label: "Images dans le texte", value: nf(q.images) },
  ]
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <SectionTitle id={id} icon={<Gauge />}>
        Qualité
      </SectionTitle>
      <div className="flex items-center gap-4">
        <ScoreRing score={q.score} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p
            className={cn(
              "m-0 text-[16px] font-semibold tracking-[-0.01em]",
              tone === "ok" ? "text-[var(--q-ok)]" : tone === "warn" ? "text-[var(--q-warn)]" : "text-[var(--q-danger)]",
            )}
          >
            {scoreVerdict(q.score)}
          </p>
          <p className="m-0 text-[12.5px] leading-snug text-[var(--q-text-3)]">Score de référencement, calculé sur le texte actuel.</p>
        </div>
      </div>
      <dl className="m-0 flex flex-col divide-y divide-[var(--q-line-soft)] rounded-xl border border-[var(--q-line)] bg-[var(--q-surface-2)] px-3.5">
        {figures.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-[13px] text-[var(--q-text-3)]">{f.label}</dt>
            <dd className="q-num m-0 text-[14px] font-semibold text-[var(--q-ink)] tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
      {q.issues.length === 0 ? (
        <p className="m-0 flex items-center gap-2 rounded-xl bg-[var(--q-ok-bg)] px-3.5 py-3 text-[13px] font-medium text-[var(--q-ok)]">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          Tout est en ordre.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <h4 className="m-0 text-[13px] font-semibold text-[var(--q-ink)]">Points à revoir</h4>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {q.issues.map((issue, i) => (
              <li key={`${issue.label}-${i}`} className="flex items-start gap-2.5 rounded-lg py-1.5">
                {issue.blocking ? (
                  <ShieldAlert className="mt-px size-4 shrink-0 text-[var(--q-danger)]" aria-hidden />
                ) : issue.status === "error" ? (
                  <CircleX className="mt-px size-4 shrink-0 text-[var(--q-danger)]" aria-hidden />
                ) : (
                  <TriangleAlert className="mt-px size-4 shrink-0 text-[var(--q-warn)]" aria-hidden />
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium leading-snug text-[var(--q-ink)]">
                    <span>
                      <span className="sr-only">{issue.status === "error" ? "À corriger" : "À améliorer"} : </span>
                      {issue.label}
                    </span>
                    {issue.blocking && (
                      <span className="inline-flex h-[18px] items-center rounded-full bg-[var(--q-danger-bg)] px-1.5 text-[10.5px] font-semibold leading-none text-[var(--q-danger)]">
                        Bloque la publication
                      </span>
                    )}
                  </span>
                  {issue.detail && <span className="line-clamp-2 text-[12px] leading-snug text-[var(--q-text-3)] [overflow-wrap:anywhere]">{issue.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Link href={`/admin/blog/${post.id}`} className="q-link inline-flex min-h-11 items-center gap-1 self-start text-[13px] md:min-h-0">
            Corriger dans l&apos;éditeur
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  )
}

/** Sections de la fiche (performances, mots-clés, qualité) ; exportées pour les tests de rendu. */
export function ArticleDetailsSections({
  details,
  period,
  onPeriodChange,
  onRetry,
}: {
  details: ArticleDetailsPayload
  period: PerformancePeriod
  onPeriodChange: (p: PerformancePeriod) => void
  onRetry: () => void
}) {
  return (
    <>
      <PerformanceSection details={details} period={period} onPeriodChange={onPeriodChange} onRetry={onRetry} />
      <div className="grid gap-8 border-t border-[var(--q-line-soft)] pt-7 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-7">
        <KeywordsSection details={details} />
        <div className="max-md:border-t max-md:border-[var(--q-line-soft)] max-md:pt-7 md:border-l md:border-[var(--q-line-soft)] md:pl-7">
          <QualitySection details={details} />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Chargement et erreur                                                */
/* ------------------------------------------------------------------ */

function DetailsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="flex gap-5 border-b border-[var(--q-line-soft)] px-5 pb-5 pt-2.5 max-sm:flex-col max-sm:gap-4 sm:pt-5 md:px-6 md:pt-6">
        <div className="flex min-h-[34px] items-center gap-1.5 sm:hidden">
          <Bar className="h-6 w-20 !rounded-full" />
          <Bar className="h-6 w-14" />
        </div>
        <Bar className="aspect-video w-44 shrink-0 !rounded-xl max-sm:w-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">
          <div className="flex gap-1.5 max-sm:hidden">
            <Bar className="h-6 w-20 !rounded-full" />
            <Bar className="h-6 w-14" />
            <Bar className="h-6 w-24" />
          </div>
          <Bar className="h-6 w-[88%]" />
          <Bar className="h-6 w-[55%]" />
          <Bar className="h-4 w-64 max-w-full" />
          <Bar className="h-4 w-52 max-w-full" />
        </div>
      </div>
      <div className="flex flex-col gap-7 px-5 py-6 md:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Bar className="h-7 w-56" />
            <Bar className="h-9 w-72 max-sm:hidden" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} className="h-[74px] !rounded-xl" />
            ))}
          </div>
          <Bar className="h-[224px] !rounded-xl max-md:h-[194px]" />
        </div>
        <div className="grid gap-7 border-t border-[var(--q-line-soft)] pt-7 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <Bar className="h-7 w-32" />
            <Bar className="h-[118px] !rounded-xl" />
            <Bar className="h-4 w-60" />
            <Bar className="h-[150px] !rounded-xl" />
          </div>
          <div className="flex flex-col gap-4">
            <Bar className="h-7 w-28" />
            <div className="flex items-center gap-4">
              <Bar className="size-[76px] !rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Bar className="h-5 w-24" />
                <Bar className="h-4 w-full" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Bar key={i} className="h-[52px]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Replanifier                                                         */
/* ------------------------------------------------------------------ */

/** Instant ISO d'un jour et d'une heure de Paris, s'il est à venir (1 minute au moins, un an au plus). */
export function rescheduleInstant(day: string, time: string, now: Date): { ok: true; iso: string } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: "Choisissez un jour et une heure." }
  const at = parisInstant(day, time)
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Date ou heure invalide." }
  if (at.getTime() < now.getTime() + 60_000) return { ok: false, error: "Choisissez une date et une heure à venir." }
  if (at.getTime() > now.getTime() + 366 * 86_400_000) return { ok: false, error: "Choisissez une date dans l'année qui vient." }
  return { ok: true, iso: at.toISOString() }
}

function ReschedulePopover({ post, onDone }: { post: DetailsPost; onDone: (message: string) => void }) {
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState("")
  const [time, setTime] = useState("08:00")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayInParis()

  // Valeurs remises à chaque ouverture, dans le même rendu que l'ouverture (aucun message d'erreur fugitif)
  function openChange(next: boolean) {
    if (next) {
      const at = post.scheduledAt ? parisDayTime(post.scheduledAt) : null
      // Date déjà passée (la tâche planifiée ne l'a pas encore reprise) : on repart d'aujourd'hui
      setDay(at && at.day >= today ? at.day : today)
      setTime(at?.time ?? "08:00")
      setError(null)
    }
    setOpen(next)
  }

  const check = rescheduleInstant(day, time, new Date())

  async function save(e: React.FormEvent) {
    e.preventDefault()
    // Date invalide : le message est déjà affiché sous les champs
    if (!check.ok || busy) return
    setBusy(true)
    setError(null)
    const res = await api(`/api/admin/blog/${post.id}`, "PATCH", { scheduled_at: check.iso })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOpen(false)
    onDone(`Publication replanifiée le ${longDateTime(check.iso)}`)
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger className="q-btn q-btn-secondary max-md:q-btn-lg max-sm:w-full">
        <CalendarClock aria-hidden />
        Replanifier
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-[min(340px,calc(100vw-2rem))] gap-0 rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface)] p-0 text-[var(--q-ink)] ![box-shadow:var(--q-shadow-pop)] ring-0"
      >
        <form onSubmit={save} noValidate className="flex flex-col gap-3.5 p-4">
          <div className="flex flex-col gap-0.5">
            <p className="m-0 text-sm font-semibold text-[var(--q-ink)]">Replanifier la publication</p>
            <p className="m-0 text-[12.5px] text-[var(--q-text-4)]">Heure de Paris. Le contrôle repasse avant la mise en ligne.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-2.5">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`${fieldId}-jour`} className="q-label">
                Jour
              </label>
              <input
                id={`${fieldId}-jour`}
                type="date"
                className="q-input"
                value={day}
                min={today}
                max={addDays(today, 365)}
                onChange={(e) => setDay(e.target.value)}
                aria-invalid={!check.ok}
                aria-describedby={`${fieldId}-quand`}
                required
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`${fieldId}-heure`} className="q-label">
                Heure
              </label>
              <input
                id={`${fieldId}-heure`}
                type="time"
                step={900}
                className="q-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-invalid={!check.ok}
                aria-describedby={`${fieldId}-quand`}
                required
              />
            </div>
          </div>
          {/* Phrase de contrôle tenue à jour à chaque saisie : la date retenue, ou ce qui ne va pas */}
          <p
            id={`${fieldId}-quand`}
            className={cn("m-0 flex min-h-[18px] items-start gap-1.5 text-[12.5px] leading-snug", check.ok ? "text-[var(--q-text-3)]" : "text-[var(--q-warn)]")}
            aria-live="polite"
          >
            {check.ok ? (
              <CalendarClock className="mt-px size-3.5 shrink-0 text-[var(--q-text-4)]" aria-hidden />
            ) : (
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            )}
            <span>{check.ok ? `Sera publié le ${longDateTime(check.iso)} (heure de Paris).` : check.error}</span>
          </p>
          {error && (
            <p role="alert" className="q-field-error m-0 !text-[12.5px]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="q-btn q-btn-ghost q-btn-sm max-md:!h-11">
              Annuler
            </button>
            <button type="submit" disabled={busy || !check.ok} className="q-btn q-btn-primary q-btn-sm max-md:!h-11">
              {busy && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
              Enregistrer
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre                                                             */
/* ------------------------------------------------------------------ */

type Blocker = { label: string; excerpt: string | null; detail: string | null }

/** État de la fiche, avec l'article auquel il se rapporte (jamais la fiche d'un autre article, même une image). */
type LoadState =
  | { status: "loading"; id: string | null }
  | { status: "error"; id: string; message: string; notFound: boolean }
  | { status: "ready"; id: string; data: ArticleDetailsPayload }

export function ArticleDetailsDialog({ postId, onClose, onChanged }: { postId: string | null; onClose: () => void; onChanged?: () => void }) {
  const router = useRouter()
  const [loaded, setState] = useState<LoadState>({ status: "loading", id: postId })
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<PerformancePeriod>("28d")
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null)
  // Libellés de la confirmation gardés pendant son animation de fermeture
  const [confirmKind, setConfirmKind] = useState<"publish" | "unpublish">("publish")
  const [busy, setBusy] = useState(false)
  const [blockers, setBlockers] = useState<Blocker[] | null>(null)
  const [announce, setAnnounce] = useState("")
  const seq = useRef(0)
  // Téléphone : le bloc extérieur défile ; ordinateur : le corps seul
  const outerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (id: string, opts: { quiet?: boolean } = {}) => {
    const n = ++seq.current
    if (opts.quiet) setRefreshing(true)
    else setState({ status: "loading", id })
    const res = await api<ArticleDetailsPayload>(`/api/admin/seo/articles/posts/${id}`, "GET")
    if (n !== seq.current) return
    setRefreshing(false)
    if (!res.ok || !res.data) {
      // Rechargement après une action : la fiche affichée reste, l'erreur passe en notification
      if (opts.quiet) {
        toast.error(res.error ?? "Fiche non mise à jour.")
        return
      }
      setState({ status: "error", id, message: res.error ?? "Une erreur est survenue. Réessayez dans un instant.", notFound: res.status === 404 })
      setAnnounce("Fiche de l'article indisponible.")
      return
    }
    setState({ status: "ready", id, data: res.data })
    setAnnounce(opts.quiet ? "Fiche de l'article mise à jour." : `Fiche de l'article « ${res.data.post.title} » chargée.`)
  }, [])

  useEffect(() => {
    // Le contenu du dernier article reste affiché pendant l'animation de fermeture (postId null)
    if (!postId) return
    setPeriod("28d")
    setConfirm(null)
    setBlockers(null)
    void load(postId)
  }, [postId, load])

  const open = postId !== null
  // Ouverture d'un autre article : squelette tout de suite, avant même la requête
  const state: LoadState = postId !== null && loaded.id !== postId ? { status: "loading", id: postId } : loaded
  const data = state.status === "ready" ? state.data : null
  const shownId = state.id
  const post = data?.post ?? null

  function askConfirm(kind: "publish" | "unpublish") {
    setConfirmKind(kind)
    setConfirm(kind)
  }

  function changed(message: string) {
    toast.success(message)
    router.refresh()
    onChanged?.()
    if (shownId) void load(shownId, { quiet: true })
  }

  async function runConfirmed() {
    if (!post || !confirm) return
    setBusy(true)
    const res = await api<{ ok?: boolean; issues?: Blocker[] }>(`/api/admin/seo/articles/posts/${post.id}`, "PATCH", { action: confirm })
    setBusy(false)
    const action = confirm
    setConfirm(null)
    if (!res.ok) {
      if (res.status === 409 && res.data?.issues) {
        setBlockers(res.data.issues)
        // La bannière est en haut du corps : on y remonte
        outerRef.current?.scrollTo({ top: 0 })
        bodyRef.current?.scrollTo({ top: 0 })
        return
      }
      toast.error(res.error ?? "Action impossible pour le moment.")
      return
    }
    setBlockers(null)
    changed(action === "publish" ? "Article publié" : "Article repassé en brouillon")
  }

  const footerButton = "q-btn max-md:q-btn-lg max-sm:w-full"

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            // Téléphone : plein écran, sans rayon ni bord
            "max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-[100dvh] max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0",
            // Ombre écrite en propriété : « shadow-[shadow:var(--q-shadow-pop)] » du kit ne produit qu'une couleur d'ombre en Tailwind 3
            "max-w-none sm:max-w-none md:max-h-[calc(100dvh-2rem)] md:max-w-[min(920px,calc(100%-2rem))] md:[box-shadow:var(--q-shadow-pop)]",
            // Téléphone : le bouton de fermeture reste lisible au-dessus du contenu qui défile, cible de 44 px
            "max-md:[&>[data-slot=dialog-close]]:z-10 max-md:[&>[data-slot=dialog-close]]:size-11 max-md:[&>[data-slot=dialog-close]]:rounded-full max-md:[&>[data-slot=dialog-close]]:bg-[var(--q-surface)] max-md:[&>[data-slot=dialog-close]]:border-[var(--q-line)]",
          )}
        >
          <p className="sr-only" role="status" aria-live="polite">
            {announce}
          </p>

          {state.status === "loading" && (
            <>
              <DialogTitle className="sr-only">Fiche de l&apos;article</DialogTitle>
              <DialogDescription className="sr-only">Chargement de la fiche de l&apos;article…</DialogDescription>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <DetailsSkeleton />
              </div>
            </>
          )}

          {state.status === "error" && (
            <>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <span aria-hidden className="grid size-12 place-items-center rounded-[14px] bg-[var(--q-wash)] text-[var(--q-accent-strong)]">
                  {state.notFound ? <FileWarning className="size-5" /> : <CloudOff className="size-5" />}
                </span>
                <DialogTitle className="text-base font-semibold text-[var(--q-ink)]">{state.notFound ? "Article introuvable" : "Fiche indisponible"}</DialogTitle>
                <DialogDescription className="max-w-sm text-sm text-[var(--q-text-3)]">{state.message}</DialogDescription>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--q-line-soft)] px-5 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end md:px-6">
                <button type="button" onClick={onClose} className={cn(footerButton, "q-btn-ghost")}>
                  Fermer
                </button>
                {!state.notFound && shownId && (
                  <button type="button" onClick={() => void load(shownId)} className={cn(footerButton, "q-btn-primary")}>
                    <RotateCcw aria-hidden />
                    Réessayer
                  </button>
                )}
              </div>
            </>
          )}

          {data && post && (
            <>
              {/* Téléphone : en-tête et sections défilent ensemble ; ordinateur : seules les sections défilent */}
              <div ref={outerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:overflow-hidden">
                <header className="shrink-0 border-b border-[var(--q-line-soft)] px-5 pb-5 pt-2.5 sm:pr-14 sm:pt-5 md:px-6 md:pr-16 md:pt-6">
                  <DetailsHeader
                    post={post}
                    title={
                      <DialogTitle className="q-display line-clamp-3 text-[22px] font-semibold leading-[1.2] text-[var(--q-ink)] [overflow-wrap:anywhere] sm:line-clamp-2">{post.title}</DialogTitle>
                    }
                  />
                  <DialogDescription className="sr-only">Performances dans Google, mots-clés et qualité de l&apos;article.</DialogDescription>
                </header>
                <div
                  ref={bodyRef}
                  className={cn(
                    "flex flex-col gap-7 px-5 py-6 transition-opacity duration-150 motion-reduce:transition-none md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:px-6",
                    refreshing && "opacity-60",
                  )}
                  aria-busy={refreshing}
                >
                  {blockers && (
                    <div role="alert" className="q-banner q-banner-danger !text-[13px]">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <p className="m-0 font-semibold">Publication refusée : le contrôle repère {blockers.length > 1 ? "des passages à corriger" : "un passage à corriger"}.</p>
                        <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
                          {blockers.map((b, i) => (
                            <li key={i}>
                              {b.label}
                              {b.excerpt ? ` : « ${b.excerpt} »` : ""}
                              {b.detail ? <span className="block text-[var(--q-text-2)]">{b.detail}</span> : null}
                            </li>
                          ))}
                        </ul>
                        <Link href={`/admin/blog/${post.id}`} className="q-link inline-flex min-h-11 items-center gap-1 self-start md:min-h-0">
                          Corriger dans l&apos;éditeur
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </Link>
                      </div>
                    </div>
                  )}
                  <ArticleDetailsSections details={data} period={period} onPeriodChange={setPeriod} onRetry={() => shownId && void load(shownId, { quiet: true })} />
                </div>
              </div>

              {/* Pied : ordinateur, « Voir sur le site » à gauche, actions à droite ; téléphone, action du statut et lien vers le site
                  sur une ligne, « Modifier l'article » pleine largeur dessous (au pouce) */}
              <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface)] px-5 py-3.5 pb-[max(14px,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end md:px-6">
                <div className="flex gap-2 sm:contents">
                  <div className="min-w-0 flex-1 sm:order-2 sm:flex-none [&>*]:w-full sm:[&>*]:w-auto">
                    {post.status === "published" && (
                      <button type="button" onClick={() => askConfirm("unpublish")} className={cn(footerButton, "q-btn-secondary")}>
                        <Undo2 aria-hidden />
                        Repasser en brouillon
                      </button>
                    )}
                    {(post.status === "draft" || post.status === "to_review") && (
                      <button type="button" onClick={() => askConfirm("publish")} className={cn(footerButton, "q-btn-secondary")}>
                        <Send aria-hidden />
                        Publier maintenant
                      </button>
                    )}
                    {post.status === "scheduled" && <ReschedulePopover post={post} onDone={changed} />}
                  </div>
                  {post.status === "published" && (
                    <a
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Voir sur le site (nouvel onglet)"
                      className="q-btn q-btn-ghost shrink-0 max-md:q-btn-lg max-sm:q-btn-secondary max-sm:!w-12 max-sm:!px-0 sm:order-1 sm:mr-auto"
                    >
                      <span className="max-sm:sr-only">Voir sur le site</span>
                      <ArrowUpRight aria-hidden />
                      <span className="sr-only">(nouvel onglet)</span>
                    </a>
                  )}
                </div>
                <Link href={`/admin/blog/${post.id}`} className={cn(footerButton, "q-btn-primary sm:order-3")}>
                  <PencilLine aria-hidden />
                  Modifier l&apos;article
                </Link>
              </footer>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation (petite fenêtre, au style des fenêtres de la liste des articles) */}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <DialogContent showCloseButton={false} className="gap-3 [box-shadow:var(--q-shadow-pop)] sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight text-[var(--q-ink)]">
            {confirmKind === "publish" ? "Publier cet article maintenant ?" : "Repasser cet article en brouillon ?"}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-3)]">
            {confirmKind === "publish"
              ? `« ${post?.title ?? ""} » paraîtra sur le blog et dans le plan du site. Le contrôle automatique repasse d'abord sur le texte.`
              : `« ${post?.title ?? ""} » quittera le blog et le plan du site ; il reste modifiable dans l'éditeur.`}
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="q-btn q-btn-ghost max-md:q-btn-lg">
              Annuler
            </button>
            <button type="button" onClick={runConfirmed} disabled={busy} className={cn("q-btn max-md:q-btn-lg", confirmKind === "publish" ? "q-btn-primary" : "q-btn-danger")}>
              {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : confirmKind === "publish" ? <Send aria-hidden /> : <Undo2 aria-hidden />}
              {confirmKind === "publish" ? "Publier" : "Repasser en brouillon"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
