/**
 * États des écrans de l'onglet SEO (planche « États des écrans » du canevas) :
 * migration en attente, lecture impossible, service non connecté, données en
 * retard, ligne d'information. Sans hook : pages serveur et client.
 */
import Link from "next/link"
import { CircleAlert, CloudOff, Info, Plug, DatabaseZap } from "lucide-react"
import { EmptyState } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import type { SeoReadFailure } from "@/lib/seo/db"

/** Migration 20261009_seo_admin.sql pas encore appliquée. */
export function MigrationPending({ className, bare }: { className?: string; bare?: boolean }) {
  return (
    <div role="status" className={cn(!bare && "q-card", className)}>
      <EmptyState
        className="py-10"
        icon={<DatabaseZap className="size-5" aria-hidden />}
        title="Section en attente de mise à jour"
        text="Cette section s'active après la mise à jour de la base de données (migration 20261009_seo_admin.sql)."
      />
    </div>
  )
}

/** Lecture en échec : jamais affichée comme une liste vide. */
export function ReadFailed({ what, className, retryHref, bare }: { what: string; className?: string; retryHref?: string; bare?: boolean }) {
  return (
    <div role="alert" className={cn(!bare && "q-card", className)}>
      <EmptyState
        className="py-10"
        icon={<CloudOff className="size-5 text-[var(--q-danger)]" aria-hidden />}
        title="Données indisponibles"
        text={`Impossible de lire ${what} pour le moment. Réessayez dans un instant.`}
        action={retryHref ? <Link href={retryHref} className="q-btn q-btn-secondary">Réessayer</Link> : undefined}
      />
    </div>
  )
}

/** Rend l'état d'échec d'une lecture (`load()` de lib/seo/db.ts). */
export function FailureState({
  failure,
  what,
  className,
  retryHref,
  bare,
}: {
  failure: SeoReadFailure
  what: string
  className?: string
  retryHref?: string
  /** Sans cadre de carte (à l'intérieur d'une carte existante). */
  bare?: boolean
}) {
  return failure === "migration_pending" ? (
    <MigrationPending className={className} bare={bare} />
  ) : (
    <ReadFailed what={what} className={className} retryHref={retryHref} bare={bare} />
  )
}

/** Service non connecté (Search Console, DataForSEO…) : lien vers Paramètres › Connexions. */
export function NotConnected({ title, text, className, bare }: { title: string; text: string; className?: string; bare?: boolean }) {
  return (
    <div className={cn(!bare && "q-card", className)}>
      <EmptyState
        className="py-10"
        icon={<Plug className="size-5" aria-hidden />}
        title={title}
        text={text}
        action={<Link href="/admin/seo/parametres/connexions" className="q-btn q-btn-secondary">Ouvrir Paramètres › Connexions</Link>}
      />
    </div>
  )
}

/** Ligne d'information discrète (pas un encart empilé). */
export function InfoLine({ children, tone = "info", className, id }: { children: React.ReactNode; tone?: "info" | "warn"; className?: string; id?: string }) {
  const Icon = tone === "warn" ? CircleAlert : Info
  return (
    <p id={id} className={cn("flex items-start gap-2 text-sm", tone === "warn" ? "text-[var(--q-warn)]" : "text-[var(--q-text-3)]", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Bandeau (info, alerte, erreur) d'une ou deux lignes. */
export function SeoBanner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "ok" | "warn" | "danger"
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const Icon = tone === "info" ? Info : CircleAlert
  const toneClass = tone === "info" ? "" : tone === "ok" ? "q-banner-ok" : tone === "warn" ? "q-banner-warn" : "q-banner-danger"
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("q-banner", toneClass, className)}>
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[13px] leading-relaxed text-[var(--q-text-2)]">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
