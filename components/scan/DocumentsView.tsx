"use client"

/**
 * Documents scannés : liste à onglets, recherche, espace utilisé, bouton
 * Scanner. Vue partagée par /documents (routes réelles) et /demo/documents
 * (données en mémoire) : règle « Mode démo » de CLAUDE.md.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight, FileText, ScanLine, Smartphone } from "lucide-react"
import { EmptyState, PageHeader, Panel, SearchField, StatusPill } from "@/components/app/kit"
import { ScanFlow } from "@/components/scan/ScanFlow"
import { ScanQrDialog } from "@/components/scan/ScanQrDialog"
import { cn } from "@/lib/utils"
import { SCAN_KIND_LABELS, documentName, formatBytes, formatMegabytes, usageRatio, type ScanDocument, type ScanKind, type ScanUsage } from "@/lib/scan/documents"
import type { ScanApi, ScanTab } from "@/lib/scan/api"

const TABS: { key: ScanTab; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "to_classify", label: "À classer" },
  { key: "quote_received", label: "Devis reçus" },
  { key: "purchase_order", label: "Bons de commande" },
  { key: "delivery_note", label: "Bons de livraison" },
]

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" })
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

function shortDate(value: string | null): string {
  if (!value) return ""
  const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : value)
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d)
}

export function DocumentsView({
  mode, api, clients, chantiers, openScanner = false,
}: {
  mode: "app" | "demo"
  api: ScanApi
  clients: { id: string; name: string }[]
  chantiers: { id: string; name: string }[]
  openScanner?: boolean
}) {
  const base = mode === "demo" ? "/demo/documents" : "/documents"
  const [tab, setTab] = useState<ScanTab>("all")
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  const [docs, setDocs] = useState<ScanDocument[] | null>(null)
  const [toClassify, setToClassify] = useState(0)
  const [usage, setUsage] = useState<ScanUsage | null>(null)
  const [available, setAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flow, setFlow] = useState(false)
  const [qr, setQr] = useState(false)
  const opened = useRef(false)

  useEffect(() => {
    const t = window.setTimeout(() => setTerm(search), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.list({ tab, search: term })
      setAvailable(res.available)
      setDocs(res.documents)
      setToClassify(res.toClassify)
      setUsage(res.usage)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vérifiez votre connexion, puis réessayez.")
      setDocs((d) => d ?? [])
    }
  }, [api, tab, term])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (openScanner && docs !== null && available && !opened.current) { opened.current = true; setFlow(true) }
  }, [openScanner, docs, available])

  const filtered = tab !== "all" || term !== ""

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Documents"
        subtitle="Devis reçus, bons de commande et bons de livraison, photographiés et classés."
        actions={
          <>
            <button type="button" onClick={() => setQr(true)} className="q-btn q-btn-secondary hidden h-11 md:inline-flex"><Smartphone aria-hidden />Avec mon téléphone</button>
            <button type="button" onClick={() => setFlow(true)} disabled={!available} className="q-btn q-btn-primary h-11"><ScanLine aria-hidden />Scanner</button>
          </>
        }
      />

      {usage && <UsageLine usage={usage} mode={mode} />}

      <div className="flex flex-col gap-3">
        <SearchField value={search} onChange={setSearch} placeholder="Fournisseur, numéro…" aria-label="Rechercher un document" />
        <div className="q-tabs" role="tablist" aria-label="Types de documents">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn(tab === t.key && "is-active")} data-active={tab === t.key}>
              {t.label}{t.key === "to_classify" && toClassify > 0 ? ` · ${toClassify}` : ""}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <Panel><EmptyState icon={<ScanLine />} title="Vos documents n'ont pas pu être chargés." text={error} action={<button type="button" onClick={() => void load()} className="q-btn q-btn-secondary">Réessayer</button>} /></Panel>
      ) : !available ? (
        <Panel><EmptyState icon={<ScanLine />} title="Les documents scannés ne sont pas encore activés." text="Ils seront disponibles dès que la mise à jour de la base sera appliquée." /></Panel>
      ) : docs === null ? (
        <div className="q-card h-48 animate-pulse" aria-busy="true" />
      ) : docs.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<ScanLine />}
            title={filtered ? "Aucun document ne correspond." : "Aucun document scanné pour l'instant."}
            text={filtered ? "Essayez un autre onglet ou une autre recherche." : "Photographiez un devis reçu, un bon de commande ou un bon de livraison : il reste classé et retrouvable."}
            action={!filtered ? <button type="button" onClick={() => setFlow(true)} className="q-btn q-btn-primary"><ScanLine aria-hidden />Scanner un document</button> : undefined}
          />
        </Panel>
      ) : (
        <ul className="q-card q-list overflow-hidden">
          {docs.map((d) => <DocRow key={d.id} doc={d} href={`${base}/${d.id}`} />)}
        </ul>
      )}

      {flow && (
        <ScanFlow
          api={api} clients={clients} chantiers={chantiers}
          onClose={() => setFlow(false)}
          onSaved={() => { setFlow(false); void load() }}
        />
      )}
      <ScanQrDialog open={qr} onOpenChange={setQr} path={`${base}?scanner=1`} />
    </div>
  )
}

function DocRow({ doc: d, href }: { doc: ScanDocument; href: string }) {
  const meta = [SCAN_KIND_LABELS[d.kind as ScanKind], d.doc_number].filter(Boolean).join(" · ")
  const sub = [shortDate(d.doc_date || d.created_at), d.amount_cents !== null ? eur.format(d.amount_cents / 100) : "", d.client_name].filter(Boolean).join(" · ")
  return (
    <li>
      <Link href={href} className="flex min-h-[72px] items-center gap-3 px-4 py-2.5 hover:bg-[var(--q-row-hover)]">
        <span className="grid h-14 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--q-line)] bg-[var(--q-surface-2)] text-[var(--q-text-4)]">
          {d.thumb_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={d.thumb_url} alt="" className="size-full object-cover" loading="lazy" />
            : <FileText className="size-5" aria-hidden />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-[var(--q-ink)]">{documentName(d)}</span>
          <span className="truncate text-[13px] text-[var(--q-text-3)]">{meta}</span>
          <span className="truncate text-[12.5px] text-[var(--q-text-4)]">{sub}{d.page_count > 1 ? ` · ${d.page_count} pages` : ""}</span>
        </span>
        {d.status === "to_classify" && <StatusPill tone="warn">À classer</StatusPill>}
        <ChevronRight className="size-4 shrink-0 text-[var(--q-text-4)]" aria-hidden />
      </Link>
    </li>
  )
}

function UsageLine({ usage, mode }: { usage: ScanUsage; mode: "app" | "demo" }) {
  const ratio = usageRatio(usage)
  const tight = ratio >= 0.8
  return (
    <div className="flex flex-col gap-1.5" aria-label="Espace de scan utilisé">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-[var(--q-text-3)]">
        <span>
          {usage.documents.toLocaleString("fr-FR")} sur {usage.quota.documents.toLocaleString("fr-FR")} documents · {formatBytes(usage.bytes)} sur {formatMegabytes(usage.quota.megabytes)}
        </span>
        {tight && usage.plan === "free" && (
          <Link href={mode === "demo" ? "/demo/settings/billing" : "/settings/billing"} className="q-link font-semibold">Voir les formules</Link>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--q-sunken)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
        <div className={cn("h-full rounded-full", ratio >= 1 ? "bg-[var(--q-danger)]" : tight ? "bg-[var(--q-warn)]" : "bg-[var(--q-accent)]")} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
    </div>
  )
}
