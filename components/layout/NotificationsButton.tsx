'use client'

/**
 * Cloche de la barre supérieure (canevas « Tableau de bord ») : ce qui demande
 * votre attention. Factures en retard, devis envoyés sans réponse depuis plus
 * de 7 jours, brouillons oubliés. Réel : GET /api/attention ; démo : calcul
 * local sur lib/demo/data. Le point bleu signale au moins un élément.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, Clock, FileClock, FilePen } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ShellIdentity } from "@/components/layout/shell"
import type { AttentionData, AttentionKind } from "@/components/search/model"

const KIND_STYLE: Record<AttentionKind, { icon: React.ElementType; tile: string }> = {
  overdue: { icon: Clock, tile: "bg-[var(--q-warn-bg)] text-[var(--q-warn)]" },
  quote: { icon: FileClock, tile: "bg-[var(--q-wash)] text-[var(--q-accent-strong)]" },
  draft: { icon: FilePen, tile: "bg-[var(--q-neutral-bg)] text-[var(--q-neutral)]" },
}

type LoadState = { status: "idle" | "loading" | "done" | "error"; data: AttentionData | null }

async function loadAttention(mode: ShellIdentity["mode"], signal: AbortSignal): Promise<AttentionData> {
  if (mode === "demo") {
    const { demoAttention } = await import("@/components/search/demo")
    return demoAttention()
  }
  const res = await fetch("/api/attention", { cache: "no-store", signal })
  if (!res.ok) throw new Error(`attention ${res.status}`)
  return res.json()
}

export function NotificationsButton({ identity }: { identity: ShellIdentity }) {
  const mode = identity.mode
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LoadState>({ status: "idle", data: null })
  const ctrlRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setState((s) => ({ ...s, status: "loading" }))
    loadAttention(mode, ctrl.signal)
      .then((data) => { if (!ctrl.signal.aborted) setState({ status: "done", data }) })
      .catch(() => { if (!ctrl.signal.aborted) setState((s) => ({ status: "error", data: s.data })) })
  }, [mode])

  // Au montage, pour le point de la cloche ; seulement là où la barre
  // supérieure est affichée (≥ lg), pas sur mobile où elle est masquée.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) refresh()
    return () => ctrlRef.current?.abort()
  }, [refresh])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) refresh()
  }

  const total = state.data?.total ?? 0
  const items = state.data?.items ?? []
  const more = total - items.length

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className="relative grid size-[38px] place-items-center rounded-[10px] text-[var(--q-text-2)] transition-colors hover:bg-[var(--q-hover)]"
        aria-label={total > 0 ? `À surveiller, ${total} élément${total > 1 ? "s" : ""}` : "À surveiller"}
      >
        <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {total > 0 && (
          <span className="absolute right-[9px] top-2 size-2 rounded-full border-2 border-[var(--q-surface)] bg-[var(--q-accent)]" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-2rem)] gap-0.5 rounded-[14px] border border-[var(--q-line)] bg-[var(--q-surface)] p-1.5 text-[var(--q-ink)] shadow-[var(--q-shadow-pop)] ring-0"
      >
        <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
          <span className="text-sm font-semibold">À surveiller</span>
          {total > 0 && <span className="q-num text-[13px] text-[var(--q-text-4)]">{total}</span>}
        </div>

        {state.status === "loading" && !state.data && (
          <p className="px-2.5 py-6 text-center text-[13px] text-[var(--q-text-4)]" role="status">Chargement…</p>
        )}
        {state.status === "error" && !state.data && (
          <div className="flex flex-col items-center gap-2 px-2.5 py-5 text-center text-[13px] text-[var(--q-text-4)]" role="alert">
            Impossible de charger les éléments à surveiller.
            <button type="button" onClick={refresh} className="text-[13px] font-semibold text-[var(--q-accent-strong)] hover:underline">
              Réessayer
            </button>
          </div>
        )}
        {state.data && items.length === 0 && (
          <p className="px-2.5 py-6 text-center text-[13px] text-[var(--q-text-4)]">Rien à surveiller pour le moment.</p>
        )}

        {items.map((item) => {
          const { icon: Icon, tile } = KIND_STYLE[item.kind]
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-[10px] p-2.5 text-[var(--q-ink)] transition-colors hover:bg-[var(--q-hover)]"
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-[9px]", tile)}>
                <Icon className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold leading-[1.35]">{item.title}</span>
                <span className="q-num truncate text-xs text-[var(--q-text-4)]">{item.meta}</span>
              </span>
            </Link>
          )
        })}

        {more > 0 && (
          <p className="px-2.5 pb-1.5 pt-1 text-xs text-[var(--q-text-4)]">
            Et {more} autre{more > 1 ? "s" : ""} élément{more > 1 ? "s" : ""}.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
