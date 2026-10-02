"use client"

/**
 * Fiche client (planches « Client-bati-ouest » et « Mobile-client-bati-ouest »).
 * Présentation partagée par /clients/[id] (API) et /demo/clients/[id]
 * (lib/demo/data.ts) : la page fournit la fiche, les documents et les actions.
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive, Building2, Ellipsis, FileCheck2, FileText, Loader2, Mail, MapPin, Pencil, Phone, Plus, ReceiptText,
} from "lucide-react"
import { DocStatusPill, EmptyState, Initials, Kpi, StatusPill } from "@/components/app/kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatCurrency } from "@/lib/utils/invoice"
import { cn } from "@/lib/utils"
import {
  DOC_TYPE_LABEL, cityLine, formatShortDate, formatSirenDisplay, plural,
  type ClientDoc, type ClientDocType, type ClientMetrics, type ClientRecord,
} from "./client-data"

/** Champs modifiables depuis la fenêtre « Coordonnées » (ceux de l'ancienne édition en ligne). */
export interface ClientContactFields {
  name: string
  email: string
  phone: string
  address: string
  zip_code: string
  city: string
}

type DocTab = "all" | ClientDocType

const DOC_ICON: Record<ClientDocType, typeof FileText> = {
  invoice: FileText,
  quote: FileCheck2,
  credit_note: ReceiptText,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ClientDetailView({
  client,
  docs,
  metrics,
  year,
  links,
  onSave,
  onArchive,
  onContact,
}: {
  client: ClientRecord
  docs: ClientDoc[]
  metrics: ClientMetrics
  year: number
  links: {
    list: string
    newQuote: string
    newInvoice: string
    /** Page de modification complète (SIREN, TVA) ; absente en démo. */
    edit?: string
  }
  /** Enregistre les coordonnées ; renvoie true pour fermer la fenêtre. */
  onSave: (fields: ClientContactFields) => Promise<boolean> | boolean
  /** Archive le client (absent : action masquée). */
  onArchive?: () => Promise<void> | void
  /** Remplace les liens « Appeler » et « Écrire » (démo : aucun appel réel). */
  onContact?: (kind: "call" | "write") => void
}) {
  const router = useRouter()
  const [tab, setTab] = useState<DocTab>("all")
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const counts: Record<DocTab, number> = {
    all: docs.length,
    invoice: docs.filter((d) => d.type === "invoice").length,
    quote: docs.filter((d) => d.type === "quote").length,
    credit_note: docs.filter((d) => d.type === "credit_note").length,
  }
  const tabs: { key: DocTab; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "invoice", label: "Factures" },
    { key: "quote", label: "Devis" },
    { key: "credit_note", label: "Avoirs" },
  ]
  const shown = tab === "all" ? docs : docs.filter((d) => d.type === tab)
  const last = docs[0]
  const place = cityLine(client)
  const tel = client.phone ? `tel:${client.phone.replace(/[^\d+]/g, "")}` : null
  const mail = client.email ? `mailto:${client.email}` : null

  const runArchive = async () => {
    if (!onArchive) return
    setArchiving(true)
    try { await onArchive(); setArchiveOpen(false) } finally { setArchiving(false) }
  }

  const dueSub = metrics.openCount > 0
    ? [plural(metrics.openCount, "facture"), metrics.lateCount > 0 ? `dont ${metrics.lateCount} en retard` : null].filter(Boolean).join(" · ")
    : "Aucune facture en attente"

  /** Bouton de contact : lien tel:/mailto:, toast en démo, inactif sans coordonnée. */
  const contactAction = (kind: "call" | "write", children: React.ReactNode, className: string) => {
    const href = kind === "call" ? tel : mail
    if (!href) return <span aria-disabled="true" className={cn(className, "pointer-events-none opacity-45")}>{children}</span>
    if (onContact) return <button type="button" onClick={() => onContact(kind)} className={className}>{children}</button>
    return <a href={href} className={className}>{children}</a>
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* ── En-tête mobile : retour et menu ──────────────────────────── */}
      <div className="-mb-2 grid grid-cols-[1fr_auto_1fr] items-center lg:hidden">
        <Link href={links.list} className="q-link inline-flex min-h-11 items-center gap-1 justify-self-start text-[16px] !font-medium">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          Clients
        </Link>
        <span className="text-base font-semibold text-[var(--q-ink)]" aria-hidden>Client</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="q-btn q-btn-ghost q-btn-icon !size-11 justify-self-end !rounded-xl" aria-label="Plus d'actions">
            <Ellipsis className="!size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-56">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />Modifier les coordonnées
            </DropdownMenuItem>
            {links.edit && (
              <DropdownMenuItem onClick={() => router.push(links.edit!)}>
                <Building2 aria-hidden />Modifier la fiche complète
              </DropdownMenuItem>
            )}
            {onArchive && !client.is_archived && (
              <DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}>
                <Archive aria-hidden />Archiver le client
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Carte d'identité mobile ──────────────────────────────────── */}
      <section className="q-card flex flex-col gap-3.5 !rounded-[22px] p-[18px] lg:hidden" aria-label="Client">
        <div className="flex items-center gap-3.5">
          <Initials name={client.name} ink className="!size-14 !rounded-2xl !text-lg" />
          <span className="flex min-w-0 flex-col gap-1">
            <h1 className="q-display text-[22px] leading-tight text-[var(--q-ink)]">{client.name}</h1>
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--q-text-4)]">
              {place || "Ville non renseignée"}
              {client.is_archived && <StatusPill tone="neutral" icon={<Archive aria-hidden />}>Archivé</StatusPill>}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5 border-t border-[var(--q-line)] pt-3">
          {[
            { label: "Reste dû", value: formatCurrency(metrics.due) },
            { label: `CA ${year}`, value: formatCurrency(metrics.billedYear) },
            { label: "Encaissé", value: formatCurrency(metrics.paid) },
          ].map((k) => (
            <span key={k.label} className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-[var(--q-text-4)]">{k.label}</span>
              <span className="truncate text-[15px] font-semibold tabular-nums text-[var(--q-ink)]">{k.value}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Actions rapides mobile ───────────────────────────────────── */}
      <nav aria-label="Actions" className="grid grid-cols-4 gap-2 lg:hidden">
        <Link href={links.newQuote} className="q-btn q-btn-primary !h-auto flex-col !gap-1.5 !rounded-2xl !px-1 !py-3 !text-xs">
          <FileCheck2 className="!size-5" aria-hidden />Devis
        </Link>
        <Link href={links.newInvoice} className="q-btn q-btn-secondary !h-auto flex-col !gap-1.5 !rounded-2xl !px-1 !py-3 !text-xs">
          <FileText className="!size-5" aria-hidden />Facture
        </Link>
        {contactAction("call", <><Phone className="!size-5" aria-hidden />Appeler</>, "q-btn q-btn-secondary !h-auto w-full flex-col !gap-1.5 !rounded-2xl !px-1 !py-3 !text-xs")}
        {contactAction("write", <><Mail className="!size-5" aria-hidden />Écrire</>, "q-btn q-btn-secondary !h-auto w-full flex-col !gap-1.5 !rounded-2xl !px-1 !py-3 !text-xs")}
      </nav>

      {/* ── En-tête ordinateur ───────────────────────────────────────── */}
      <div className="hidden flex-wrap items-end justify-between gap-4 lg:flex">
        <div className="flex min-w-0 items-center gap-4">
          <Initials name={client.name} ink className="!size-14 !rounded-2xl !text-lg" />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5 text-sm text-[var(--q-text-3)]">
              <span>{place || "Ville non renseignée"}</span>
              {client.siren
                ? <span className="font-mono text-[13px] text-[var(--q-text-4)]">SIREN {formatSirenDisplay(client.siren)}</span>
                : null}
              {client.is_archived && <StatusPill tone="neutral" icon={<Archive aria-hidden />}>Archivé</StatusPill>}
            </div>
            <h1 className="q-h1 !text-[30px]">{client.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.edit ? (
            <Link href={links.edit} className="q-btn q-btn-ghost">
              <Pencil aria-hidden />Modifier
            </Link>
          ) : (
            <button type="button" onClick={() => setEditOpen(true)} className="q-btn q-btn-ghost">
              <Pencil aria-hidden />Modifier
            </button>
          )}
          <Link href={links.newInvoice} className="q-btn q-btn-secondary">
            <FileText aria-hidden />Nouvelle facture
          </Link>
          <Link href={links.newQuote} className="q-btn q-btn-primary">
            <Plus strokeWidth={2.25} aria-hidden />Nouveau devis
          </Link>
        </div>
      </div>

      {/* ── Indicateurs ordinateur ───────────────────────────────────── */}
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        <Kpi label="À encaisser" value={formatCurrency(metrics.due)} sub={dueSub} className="!gap-1.5 !rounded-[14px] !p-4" />
        <Kpi label={`Chiffre d'affaires ${year}`} value={formatCurrency(metrics.billedYear)} sub="TTC facturé, avoirs déduits" className="!gap-1.5 !rounded-[14px] !p-4" />
        <Kpi label="Encaissé" value={formatCurrency(metrics.paid)} sub={plural(metrics.paidCount, "facture payée", "factures payées")} className="!gap-1.5 !rounded-[14px] !p-4" />
        <Kpi
          tone="ink"
          label="Dernier document"
          value={last
            ? <span className="flex flex-wrap items-baseline gap-x-2 text-[19px] leading-snug"><span className="font-mono text-[17px]">{last.number}</span><span>· {formatShortDate(last.issue_date, year)}</span></span>
            : <span className="text-[19px]">Aucun</span>}
          sub={last ? plural(docs.length, "document au total", "documents au total") : "Pas encore de devis ni de facture"}
          className="!gap-1.5 !rounded-[14px] !p-4"
        />
      </div>

      {/* ── Corps : documents à gauche, coordonnées à droite ─────────── */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:gap-5">
        {/* Documents */}
        <section aria-label="Documents" className="order-2 flex min-w-0 flex-col gap-3 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="flex items-baseline justify-between lg:hidden">
            <h2 className="q-h2">Documents</h2>
            <span className="text-[13px] tabular-nums text-[var(--q-text-4)]">{docs.length}</span>
          </div>
          {docs.length > 0 && (
            <div role="tablist" aria-label="Filtrer les documents" className="q-tabs">
              {tabs.map((t) => {
                const on = tab === t.key
                return (
                  <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}>
                    {t.label}
                    <span className={cn("q-count", on && "rounded-md bg-[var(--q-wash)] px-[7px] py-px font-semibold")}>{counts[t.key]}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="q-card overflow-hidden !rounded-[18px] lg:!rounded-2xl">
            {docs.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-5" aria-hidden />}
                title="Aucun document pour le moment"
                text={`Faites un devis à ${client.name} : il le reçoit par e-mail, en PDF.`}
                action={
                  <Link href={links.newQuote} className="q-btn q-btn-primary">
                    <Plus strokeWidth={2.25} aria-hidden />Nouveau devis
                  </Link>
                }
              />
            ) : shown.length === 0 ? (
              <p className="px-5 py-10 text-center text-[15px] text-[var(--q-text-3)]">Aucun document de ce type.</p>
            ) : (
              <ul className="q-list">
                {shown.map((d) => {
                  const Icon = DOC_ICON[d.type]
                  const amount = d.amount < 0 ? `− ${formatCurrency(-d.amount)}` : formatCurrency(d.amount)
                  const pill = d.type === "credit_note"
                    ? <StatusPill tone="neutral">Avoir émis</StatusPill>
                    : <DocStatusPill kind={d.type} status={d.status ?? "draft"} />
                  return (
                    <li key={d.key}>
                      {/* Ordinateur : icône, objet et numéro, date, montant, statut */}
                      <Link
                        href={d.href}
                        className="hidden grid-cols-[34px_minmax(0,1fr)_96px_120px_118px] items-center gap-3 px-[18px] py-3 text-[var(--q-ink)] transition-colors hover:bg-[var(--q-row-hover)] lg:grid"
                      >
                        <span className="grid size-[34px] place-items-center rounded-[9px] bg-[var(--q-sunken)] text-[var(--q-text-3)]">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-col gap-px">
                          <span className="truncate text-sm font-semibold">{d.title}</span>
                          <span className="font-mono text-xs text-[var(--q-text-4)]">{DOC_TYPE_LABEL[d.type]} {d.number}</span>
                        </span>
                        <span className="text-[13px] text-[var(--q-text-3)]">{formatShortDate(d.issue_date, year)}</span>
                        <span className="text-right text-sm font-semibold tabular-nums">{amount}</span>
                        <span>{pill}</span>
                      </Link>
                      {/* Mobile : type et numéro, objet, montant et statut à droite */}
                      <Link href={d.href} className="q-list-row !px-3.5 !py-2.5 lg:hidden">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[15px] font-semibold">
                            {DOC_TYPE_LABEL[d.type]} <span className="font-mono text-[13px] font-medium">{d.number}</span>
                          </span>
                          <span className="truncate text-[13px] text-[var(--q-text-4)]">{d.title}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[15px] font-semibold tabular-nums">{amount}</span>
                          {pill}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Coordonnées */}
        <section aria-label="Coordonnées" className="order-1 flex min-w-0 flex-col gap-2 lg:order-none lg:col-start-2 lg:row-start-1">
          <div className="flex items-center justify-between lg:hidden">
            <h2 className="q-h2">Coordonnées</h2>
            <button type="button" onClick={() => setEditOpen(true)} className="q-btn q-btn-ghost q-btn-sm !text-[var(--q-accent-strong)]">Modifier</button>
          </div>

          {/* Mobile : lignes avec pastille d'icône */}
          <div className="q-card q-list overflow-hidden !rounded-[18px] lg:hidden">
            {[
              { icon: Mail, value: client.email, label: "E-mail", empty: "E-mail non renseigné", kind: "write" as const, href: mail },
              { icon: Phone, value: client.phone, label: "Téléphone", empty: "Téléphone non renseigné", kind: "call" as const, href: tel },
              { icon: MapPin, value: [client.address, place].filter(Boolean).join(", ") || null, label: "Adresse", empty: "Adresse non renseignée" },
              {
                icon: Building2,
                value: client.siren ? `SIREN ${formatSirenDisplay(client.siren)}` : null,
                label: client.vat_number ? `TVA ${client.vat_number}` : "Entreprise",
                empty: "SIREN non renseigné",
                mono: true,
              },
            ].map(({ icon: Icon, value, label, empty, kind, href, mono }) => {
              const body = (
                <>
                  <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[var(--q-sunken)] text-[var(--q-text-3)]">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    {value ? (
                      <>
                        <span className={cn("truncate text-[15px] font-semibold", mono && "font-mono text-sm !font-medium")}>{value}</span>
                        <span className={cn("truncate text-[13px] text-[var(--q-text-4)]", mono && client.vat_number && "font-mono text-xs")}>{label}</span>
                      </>
                    ) : (
                      <span className="text-[15px] text-[var(--q-text-4)]">{empty}</span>
                    )}
                  </span>
                </>
              )
              if (value && kind && onContact) {
                return <button key={label} type="button" onClick={() => onContact(kind)} className="q-list-row w-full !px-3.5 !py-2.5">{body}</button>
              }
              if (value && href) return <a key={label} href={href} className="q-list-row !px-3.5 !py-2.5">{body}</a>
              return <div key={label} className="q-list-row !px-3.5 !py-2.5">{body}</div>
            })}
          </div>

          {/* Ordinateur : carte compacte */}
          <div className="q-card hidden flex-col gap-3.5 p-[18px] lg:flex">
            <div className="flex items-center justify-between">
              <h2 className="q-h2">Coordonnées</h2>
              <button type="button" onClick={() => setEditOpen(true)} className="q-btn q-btn-ghost q-btn-sm !h-8 !px-2.5 !text-[var(--q-accent-strong)]">Modifier</button>
            </div>
            <CoordLine icon={Mail}>
              {client.email
                ? (onContact ? <span className="break-words">{client.email}</span> : <a href={mail!} className="q-link break-words !font-normal">{client.email}</a>)
                : <span className="text-[var(--q-text-4)]">E-mail non renseigné</span>}
            </CoordLine>
            <CoordLine icon={Phone}>
              {client.phone ? <span className="tabular-nums">{client.phone}</span> : <span className="text-[var(--q-text-4)]">Téléphone non renseigné</span>}
            </CoordLine>
            <CoordLine icon={MapPin}>
              {client.address || place
                ? <span>{client.address}{client.address && place ? <br /> : null}{place}</span>
                : <span className="text-[var(--q-text-4)]">Adresse non renseignée</span>}
            </CoordLine>
            <div className="flex flex-col gap-1.5 border-t border-[var(--q-line-soft)] pt-3">
              {client.siren ? (
                <span className="font-mono text-[13px] text-[var(--q-text-2)]">SIREN {formatSirenDisplay(client.siren)}</span>
              ) : (
                <span className="flex items-center justify-between gap-2">
                  <StatusPill tone="warn">Sans SIREN</StatusPill>
                  {links.edit && <Link href={links.edit} className="q-link text-[13px]">Ajouter</Link>}
                </span>
              )}
              {client.vat_number && <span className="font-mono text-[13px] text-[var(--q-text-3)]">TVA {client.vat_number}</span>}
            </div>
          </div>
        </section>

        {/* Archivage */}
        {onArchive && (
          <section aria-label="Archivage" className="q-card order-3 flex flex-col gap-2.5 p-[18px] lg:order-none lg:col-start-2 lg:row-start-2 lg:self-start">
            <h2 className="q-h2">Archivage</h2>
            {client.is_archived ? (
              <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
                Ce client est archivé : il n&apos;apparaît plus dans la liste active. Ses documents restent consultables ici.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-[var(--q-text-3)]">
                  L&apos;archivage retire le client de la liste. Ses devis, factures et avoirs sont conservés.
                </p>
                <Button variant="destructive" size="sm" className="self-start" onClick={() => setArchiveOpen(true)}>
                  <Archive aria-hidden />Archiver ce client
                </Button>
              </>
            )}
          </section>
        )}
      </div>

      <EditContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        editHref={links.edit}
        onSave={onSave}
      />

      {/* Confirmation d'archivage */}
      <Dialog open={archiveOpen} onOpenChange={(o) => { if (!archiving) setArchiveOpen(o) }}>
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Archiver {client.name}&nbsp;?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--q-text-3)]">
            Le client sort de la liste des clients actifs. Ses devis, factures et avoirs sont conservés.
          </DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setArchiveOpen(false)} disabled={archiving}>Annuler</Button>
            <Button variant="destructive" onClick={runArchive} disabled={archiving}>
              {archiving ? <Loader2 className="animate-spin" aria-hidden /> : <Archive aria-hidden />}
              Archiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CoordLine({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm leading-snug text-[var(--q-ink)]">
      <Icon className="mt-px size-[18px] shrink-0 text-[var(--q-text-4)]" aria-hidden />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Fenêtre « Modifier les coordonnées »                                */
/* ------------------------------------------------------------------ */

function EditContactDialog({
  open,
  onOpenChange,
  client,
  editHref,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ClientRecord
  editHref?: string
  onSave: (fields: ClientContactFields) => Promise<boolean> | boolean
}) {
  const initial = (): ClientContactFields => ({
    name: client.name ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    zip_code: client.zip_code ?? "",
    city: client.city ?? "",
  })
  const [form, setForm] = useState<ClientContactFields>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof ClientContactFields, string>>>({})
  const [saving, setSaving] = useState(false)

  // Repart de la fiche à chaque ouverture (annuler efface la saisie)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setForm(initial()); setErrors({}) }
  }

  const set = (key: keyof ClientContactFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (form.name.trim().length < 2) errs.name = "Raison sociale requise (2 caractères min.)"
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) errs.email = "Adresse e-mail invalide"
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      if (await onSave(form)) onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof ClientContactFields, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={`edit-${key}`}>{label}</Label>
      <Input
        id={`edit-${key}`}
        value={form[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `edit-${key}-err` : undefined}
        {...props}
      />
      {errors[key] && <p id={`edit-${key}-err`} className="q-field-error">{errors[key]}</p>}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto !p-0 sm:max-w-[560px]">
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-1 px-[22px] pb-0 pt-5 pr-14">
            <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Modifier {client.name}</DialogTitle>
            <DialogDescription className="text-sm text-[var(--q-text-4)]">Coordonnées du client.</DialogDescription>
          </div>
          <div className="grid gap-3 px-[22px] pb-5 pt-[18px] sm:grid-cols-2">
            <div className="sm:col-span-2">{field("name", "Nom ou raison sociale", { autoComplete: "organization" })}</div>
            {field("email", "E-mail", { type: "email", autoComplete: "email", placeholder: "nom@entreprise.fr" })}
            {field("phone", "Téléphone", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
            <div className="sm:col-span-2">{field("address", "Adresse", { autoComplete: "street-address" })}</div>
            {field("zip_code", "Code postal", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 5 })}
            {field("city", "Ville", { autoComplete: "address-level2" })}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--q-line-soft)] bg-[var(--q-surface-2)] px-[22px] py-4">
            {editHref && (
              <Link href={editHref} className="q-link mr-auto text-[13px]">SIREN et TVA</Link>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
