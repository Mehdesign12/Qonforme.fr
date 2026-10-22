"use client"

/**
 * « À faire et notes » : tâches à cocher (avec échéance facultative) et notes
 * datées. Un seul panneau pour la fiche d'un chantier, la fiche d'un client, le
 * planning et le tableau de bord ; la page lui donne une `api` (routes réelles,
 * ou données en mémoire dans la démo — règle « Mode démo » de CLAUDE.md).
 *
 * Reste invisible tant que la migration n'est pas appliquée : une fonction
 * annexe ne montre jamais d'erreur à la place de la page qui l'accueille.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell, Check, ChevronDown, Loader2, NotebookPen, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Panel } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { dayLabel, parisParts } from "@/lib/planning/appointments"
import { REMIND_CHOICES, REMIND_LABELS, isLate, splitNotes, type NoteKind, type RemindChoice, type WorkNote } from "@/lib/planning/notes"

export interface NoteScope {
  chantier_id?: string | null
  client_id?: string | null
  /** Tâches ouvertes de tout le compte (planning, tableau de bord). */
  openOnly?: boolean
}

export interface NotesApi {
  list(scope: NoteScope): Promise<{ available: boolean; today: string; notes: WorkNote[] }>
  create(input: { kind: NoteKind; body: string; due_date: string | null; remind: RemindChoice | null; client_id: string | null; chantier_id: string | null }): Promise<WorkNote>
  patch(id: string, patch: { done?: boolean; body?: string; due_date?: string | null }): Promise<WorkNote>
  remove(id: string): Promise<void>
}

function dueLabel(day: string, today: string): string {
  if (day === today) return "Aujourd'hui"
  const [y, m, d] = day.split("-").map(Number)
  const [ty, tm, td] = today.split("-").map(Number)
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
  if (diff === 1) return "Demain"
  if (diff === -1) return "Hier"
  return dayLabel(day).replace(/^\S+ /, "")
}

export function NotesPanel({
  api, scope, title = "À faire et notes", focusComposer = false, compact = false, hideWhenEmpty = false, className,
}: {
  api: NotesApi
  scope: NoteScope
  title?: string
  /** Place le curseur dans le champ à l'ouverture (menu « Note rapide »). */
  focusComposer?: boolean
  /** Tâches ouvertes seulement, sans champ de saisie (tableau de bord). */
  compact?: boolean
  /** Ne rien afficher quand il n'y a rien (tableau de bord). */
  hideWhenEmpty?: boolean
  className?: string
}) {
  const [notes, setNotes] = useState<WorkNote[] | null>(null)
  const [today, setToday] = useState("")
  const [available, setAvailable] = useState(true)
  const [failed, setFailed] = useState(false)
  const [kind, setKind] = useState<NoteKind>("task")
  const [text, setText] = useState("")
  const [due, setDue] = useState("")
  const [remind, setRemind] = useState<RemindChoice | "">("")
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const scopeKey = `${scope.chantier_id ?? ""}|${scope.client_id ?? ""}|${scope.openOnly ? 1 : 0}`

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await api.list(scope)
      setAvailable(res.available)
      setToday(res.today)
      setNotes(res.notes)
    } catch {
      setFailed(true)
      setNotes([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, scopeKey])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (focusComposer && notes !== null && available) {
      areaRef.current?.scrollIntoView({ block: "center" })
      areaRef.current?.focus({ preventScroll: true })
    }
  }, [focusComposer, notes, available])

  if (notes === null || !available || failed) return null
  const { open, done, texts } = splitNotes(notes)
  if (hideWhenEmpty && open.length === 0) return null

  const add = async () => {
    const body = text.trim()
    if (!body || adding) return
    setAdding(true)
    try {
      const created = await api.create({
        kind, body, due_date: kind === "task" && due ? due : null, remind: kind === "task" && due && remind ? remind : null,
        client_id: scope.client_id ?? null, chantier_id: scope.chantier_id ?? null,
      })
      setNotes((prev) => [created, ...(prev ?? [])])
      setText("")
      setDue("")
      setRemind("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ajouter. Réessayez.")
    } finally {
      setAdding(false)
    }
  }

  const toggle = async (n: WorkNote) => {
    const want = !n.done_at
    // Affichage immédiat, annulé si l'enregistrement échoue
    setNotes((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, done_at: want ? new Date().toISOString() : null } : x)))
    try {
      const saved = await api.patch(n.id, { done: want })
      setNotes((prev) => (prev ?? []).map((x) => (x.id === n.id ? saved : x)))
    } catch (e) {
      setNotes((prev) => (prev ?? []).map((x) => (x.id === n.id ? n : x)))
      toast.error(e instanceof Error ? e.message : "Impossible de modifier. Réessayez.")
    }
  }

  const remove = async (n: WorkNote) => {
    if (confirming !== n.id) { setConfirming(n.id); return }
    setConfirming(null)
    try {
      await api.remove(n.id)
      setNotes((prev) => (prev ?? []).filter((x) => x.id !== n.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de supprimer. Réessayez.")
    }
  }

  const empty = open.length === 0 && texts.length === 0 && done.length === 0

  return (
    <Panel title={title} aria-label={title} className={className} bodyClassName="flex flex-col gap-4 px-5 pb-5">
      {!compact && (
        <form className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); void add() }}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="q-seg" role="group" aria-label="Type">
              <button type="button" aria-pressed={kind === "task"} onClick={() => setKind("task")} className="!h-10">À faire</button>
              <button type="button" aria-pressed={kind === "note"} onClick={() => setKind("note")} className="!h-10">Note</button>
            </div>
            {kind === "task" && (
              <label className="flex items-center gap-2 text-sm text-[var(--q-text-3)]">
                <span>Pour le</span>
                <input type="date" className="q-input !h-10 w-auto" value={due} onChange={(e) => { setDue(e.target.value); if (!e.target.value) setRemind("") }} aria-label="Échéance (facultatif)" />
              </label>
            )}
            {kind === "task" && due && (
              <label className="flex items-center gap-2 text-sm text-[var(--q-text-3)]">
                <Bell className="size-4" aria-hidden />
                <select className="q-input !h-10 w-auto" value={remind} onChange={(e) => setRemind(e.target.value as RemindChoice | "")} aria-label="Rappel par email">
                  <option value="">Pas de rappel</option>
                  {REMIND_CHOICES.map((c) => <option key={c} value={c}>Rappel {REMIND_LABELS[c].toLowerCase()}</option>)}
                </select>
              </label>
            )}
          </div>
          <textarea
            ref={areaRef}
            className="q-input min-h-[72px] resize-y py-2.5"
            rows={2}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add() } }}
            placeholder={kind === "task" ? "Commander le receveur de douche…" : "Écrire une note…"}
            aria-label={kind === "task" ? "Nouvelle tâche" : "Nouvelle note"}
          />
          <button type="submit" disabled={!text.trim() || adding} className="q-btn q-btn-primary h-11 self-end">
            {adding ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            Ajouter
          </button>
        </form>
      )}

      {empty && (
        <p className="flex items-center gap-2 text-sm text-[var(--q-text-4)]">
          <NotebookPen className="size-4" aria-hidden />
          {compact ? "Rien à faire." : "Rien pour l'instant. Une tâche, un rappel, une remarque de chantier : tout se garde ici."}
        </p>
      )}

      {open.length > 0 && (
        <ul className="flex flex-col">
          {open.map((n) => (
            <TaskRow key={n.id} note={n} today={today} confirming={confirming === n.id} onToggle={() => void toggle(n)} onRemove={compact ? undefined : () => void remove(n)} />
          ))}
        </ul>
      )}

      {!compact && texts.length > 0 && (
        <ul className="flex flex-col">
          {texts.map((n) => (
            <li key={n.id} className="flex items-start gap-2 border-t border-[var(--q-line-soft)] py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line break-words text-[14.5px] leading-snug text-[var(--q-ink)]">{n.body}</p>
                <p className="mt-1 font-mono text-[12px] text-[var(--q-text-4)]">{dayLabel(parisParts(n.created_at).date)}{n.client_name && !scope.client_id ? ` · ${n.client_name}` : ""}</p>
              </div>
              <DeleteButton confirming={confirming === n.id} onClick={() => void remove(n)} />
            </li>
          ))}
        </ul>
      )}

      {!compact && done.length > 0 && (
        <div className="border-t border-[var(--q-line-soft)] pt-2">
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="q-link inline-flex min-h-11 items-center gap-1.5 text-sm">
            <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} aria-hidden />
            {done.length} {done.length > 1 ? "tâches terminées" : "tâche terminée"}
          </button>
          {showDone && (
            <ul className="flex flex-col">
              {done.map((n) => <TaskRow key={n.id} note={n} today={today} confirming={confirming === n.id} onToggle={() => void toggle(n)} onRemove={() => void remove(n)} />)}
            </ul>
          )}
        </div>
      )}
    </Panel>
  )
}

function TaskRow({ note: n, today, confirming, onToggle, onRemove }: {
  note: WorkNote; today: string; confirming: boolean; onToggle: () => void; onRemove?: () => void
}) {
  const late = isLate(n, today)
  const done = Boolean(n.done_at)
  return (
    <li className="flex items-start gap-1 border-t border-[var(--q-line-soft)] first:border-t-0">
      <button
        type="button" role="checkbox" aria-checked={done} onClick={onToggle}
        aria-label={`${done ? "Remettre à faire" : "Marquer comme fait"} : ${n.body}`}
        className="grid size-11 shrink-0 place-items-center"
      >
        <span className={cn("grid size-6 place-items-center rounded-lg border-[1.5px]", done ? "border-[var(--q-accent)] bg-[var(--q-accent)] text-white" : "border-[var(--q-field)]")}>
          {done && <Check className="size-4" strokeWidth={2.75} aria-hidden />}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-2.5">
        <p className={cn("whitespace-pre-line break-words text-[14.5px] font-medium leading-snug", done ? "text-[var(--q-text-4)] line-through" : "text-[var(--q-ink)]")}>{n.body}</p>
        {(n.due_date || n.client_name) && (
          <p className={cn("mt-0.5 text-[12.5px]", late ? "font-semibold text-[var(--q-warn)]" : "text-[var(--q-text-4)]")}>
            {n.due_date ? (late ? `En retard · ${dueLabel(n.due_date, today)}` : dueLabel(n.due_date, today)) : ""}
            {n.due_date && n.client_name ? " · " : ""}
            {n.client_name ?? ""}
            {n.remind_at && !done && <Bell className="ml-1.5 inline size-3.5 align-[-2px]" aria-label="Rappel par email prévu" />}
          </p>
        )}
      </div>
      {onRemove && <DeleteButton confirming={confirming} onClick={onRemove} />}
    </li>
  )
}

function DeleteButton({ confirming, onClick }: { confirming: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      aria-label={confirming ? "Confirmer la suppression" : "Supprimer"}
      className={cn("inline-flex size-11 shrink-0 items-center justify-center gap-1 rounded-xl text-[13px] font-semibold", confirming ? "w-auto px-3 text-[var(--q-danger)]" : "text-[var(--q-text-4)]")}
    >
      <Trash2 className="size-4" aria-hidden />
      {confirming && "Confirmer"}
    </button>
  )
}
