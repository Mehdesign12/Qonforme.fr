/**
 * « À faire » (réel et démo), construit uniquement à partir des données :
 * factures en retard à relancer, devis acceptés à facturer, devis envoyés qui
 * expirent sous 7 jours, factures en brouillon. Ni situations de travaux, ni
 * factures fournisseurs : fonctions non livrées (DECISIONS § 10).
 *
 * Ordinateur : bouton d'action par ligne (« Relancer » envoie la relance).
 * Mobile : ligne entière cliquable vers la page qui traite la tâche.
 */
import Link from "next/link"
import { ChevronRight, Clock, FileCheck2, FileClock, FilePen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashMode, TodoIcon, TodoItem, TodoTone } from "@/components/dashboard/model"
import { ListHeading } from "@/components/dashboard/ui"
import { RemindButton } from "@/components/dashboard/RemindButton"

const ICONS: Record<TodoIcon, typeof Clock> = {
  clock: Clock,
  list: Clock,
  "quote-check": FileCheck2,
  "quote-clock": FileClock,
  draft: FilePen,
}

const TONES: Record<TodoTone, string> = {
  warn: "bg-[var(--q-warn-bg)] text-[var(--q-warn)]",
  info: "bg-[var(--q-wash)] text-[var(--q-accent-strong)]",
  neutral: "bg-[var(--q-sunken)] text-[var(--q-text-3)]",
}

function IconTile({ item, large }: { item: TodoItem; large?: boolean }) {
  const Icon = ICONS[item.icon]
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center",
        large ? "size-9 rounded-[11px]" : "size-8 rounded-[9px]",
        TONES[item.tone],
      )}
    >
      <Icon className={large ? "size-[17px]" : "size-4"} strokeWidth={2} aria-hidden />
    </span>
  )
}

const EMPTY = "Rien à faire pour le moment."

export function TodoCard({ todos, mode }: { todos: TodoItem[]; mode: DashMode }) {
  return (
    <>
      {/* Mobile */}
      <section aria-labelledby="dash-todo-m" className="flex flex-col gap-2 md:hidden">
        <ListHeading
          id="dash-todo-m"
          title="À faire"
          aside={todos.length > 0 && <span className="text-[13px] text-[var(--q-text-4)] tabular-nums">{todos.length}</span>}
        />
        <div className="q-card q-list overflow-hidden rounded-[18px]">
          {todos.length === 0 ? (
            <p className="px-3.5 py-4 text-sm text-[var(--q-text-4)]">{EMPTY}</p>
          ) : (
            todos.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-[var(--q-row-hover)]"
              >
                <IconTile item={t} large />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold leading-snug text-[var(--q-ink)]">{t.title}</span>
                  <span className="text-[13px] text-[var(--q-text-4)] tabular-nums">{t.meta}</span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-[var(--q-placeholder)]" strokeWidth={2} aria-hidden />
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Ordinateur */}
      <section aria-labelledby="dash-todo" className="q-card hidden py-1.5 md:block">
        <h2 id="dash-todo" className="q-h2 px-[18px] pb-2 pt-3">À faire</h2>
        {todos.length === 0 ? (
          <p className="border-t border-[var(--q-line-soft)] px-[18px] py-3 text-sm text-[var(--q-text-4)]">{EMPTY}</p>
        ) : (
          <ul>
            {todos.map((t) => (
              <li key={t.key} className="flex items-center gap-3 border-t border-[var(--q-line-soft)] px-[18px] py-3">
                <IconTile item={t} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={t.href} className="text-sm font-semibold leading-snug text-[var(--q-ink)] hover:text-[var(--q-accent-strong)]">
                    {t.title}
                  </Link>
                  <span className="text-xs text-[var(--q-text-4)] tabular-nums">{t.meta}</span>
                </div>
                {t.action.kind === "remind" ? (
                  <RemindButton
                    invoiceId={t.action.invoiceId}
                    invoiceNumber={t.action.invoiceNumber}
                    clientName={t.action.clientName}
                    demo={mode === "demo"}
                  />
                ) : (
                  <Link href={t.href} className="q-btn q-btn-secondary !h-8 shrink-0 !rounded-lg !px-2.5 !text-[13px]">
                    {t.action.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
