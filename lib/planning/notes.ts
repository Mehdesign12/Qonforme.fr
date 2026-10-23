/**
 * Notes et tâches de l'artisan, par chantier, par client ou libres.
 *
 * Une tâche (`task`) a une échéance facultative (un jour, heure de Paris) et se
 * coche ; une note (`note`) est un texte daté. Module pur : validation des
 * entrées des routes, ordre d'affichage, retard.
 */
import { addDays, isIsoDay } from "@/lib/utils/paris-date"
import { parisParts, parisToIso } from "@/lib/planning/appointments"

export const NOTE_KINDS = ["note", "task"] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

export interface WorkNote {
  id: string
  kind: NoteKind
  body: string
  /** Échéance d'une tâche : jour AAAA-MM-JJ à Paris, ou null. */
  due_date: string | null
  done_at: string | null
  /** Rappel par email : heure (ISO) tant qu'il n'est pas parti, sinon null. */
  remind_at: string | null
  client_id: string | null
  client_name: string | null
  chantier_id: string | null
  created_at: string
}

export const NOTE_COLUMNS = "id, kind, body, due_at, remind_at, reminder_sent_at, done_at, client_id, chantier_id, created_at, client:clients(name)"

type Join = { name?: string | null } | { name?: string | null }[] | null

export function noteFromRow(row: Record<string, unknown>): WorkNote {
  const join = row.client as Join
  const client = Array.isArray(join) ? join[0] ?? null : join
  const due = row.due_at ? parisParts(String(row.due_at)).date : null
  return {
    id: String(row.id),
    kind: row.kind === "task" ? "task" : "note",
    body: String(row.body ?? ""),
    due_date: due,
    done_at: (row.done_at as string | null) ?? null,
    remind_at: row.remind_at && !row.reminder_sent_at ? String(row.remind_at) : null,
    client_id: (row.client_id as string | null) ?? null,
    client_name: client?.name ?? null,
    chantier_id: (row.chantier_id as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BODY_MAX = 4000

function idOf(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null
  return typeof value === "string" && UUID.test(value) ? value : "invalid"
}

/** Échéance à midi, heure de Paris : le jour reste le même quel que soit le fuseau du lecteur. */
export function dueAtOf(day: string): string {
  return parisToIso(day, "12:00")
}

/** Rappel d'une tâche : le matin de l'échéance (8 h) ou la veille au soir (18 h), heure de Paris. */
export const REMIND_CHOICES = ["morning", "eve"] as const
export type RemindChoice = (typeof REMIND_CHOICES)[number]
export const REMIND_LABELS: Record<RemindChoice, string> = { morning: "Le matin (8 h)", eve: "La veille (18 h)" }

export function remindAtOf(day: string, choice: RemindChoice): string {
  return choice === "morning" ? parisToIso(day, "08:00") : parisToIso(addDays(day, -1), "18:00")
}

export interface NoteInput {
  kind: NoteKind
  body: string
  due_at: string | null
  remind_at: string | null
  client_id: string | null
  chantier_id: string | null
}

export function parseNoteInput(
  body: Record<string, unknown>,
  now: Date = new Date(),
): { ok: true; value: NoteInput } | { ok: false; error: string } {
  const kind = body.kind ?? "note"
  if (typeof kind !== "string" || !(NOTE_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Type inconnu." }
  }
  const text = typeof body.body === "string" ? body.body.trim() : ""
  if (text.length === 0) return { ok: false, error: "Écrivez quelque chose avant d'ajouter." }
  if (text.length > BODY_MAX) return { ok: false, error: "Le texte est trop long (4 000 caractères au plus)." }

  let due_at: string | null = null
  if (body.due_date !== undefined && body.due_date !== null && body.due_date !== "") {
    if (kind !== "task") return { ok: false, error: "Seule une tâche a une échéance." }
    if (!isIsoDay(body.due_date)) return { ok: false, error: "Échéance invalide." }
    due_at = dueAtOf(body.due_date)
  }
  let remind_at: string | null = null
  if (body.remind !== undefined && body.remind !== null && body.remind !== "") {
    if (!(REMIND_CHOICES as readonly unknown[]).includes(body.remind)) return { ok: false, error: "Rappel invalide." }
    if (kind !== "task" || due_at === null) return { ok: false, error: "Un rappel demande une tâche avec une échéance." }
    remind_at = remindAtOf(body.due_date as string, body.remind as RemindChoice)
    // Un rappel à une heure déjà passée ne partirait jamais comme prévu : on le refuse plutôt que de l'envoyer tout de suite
    if (new Date(remind_at).getTime() <= now.getTime()) return { ok: false, error: "Cette heure de rappel est déjà passée. Choisissez une autre échéance ou un autre rappel." }
  }
  const clientId = idOf(body.client_id)
  const chantierId = idOf(body.chantier_id)
  if (clientId === "invalid") return { ok: false, error: "Client invalide." }
  if (chantierId === "invalid") return { ok: false, error: "Chantier invalide." }
  return { ok: true, value: { kind: kind as NoteKind, body: text, due_at, remind_at, client_id: clientId, chantier_id: chantierId } }
}

export interface NotePatch {
  update: Record<string, unknown>
  /** La modification ne vaut que pour une tâche (cocher, échéance). */
  taskOnly: boolean
}

/** Corps d'un PATCH : texte, échéance (tâche), fait ou à faire (tâche). `now` injecté pour les tests. */
export function parseNotePatch(
  body: Record<string, unknown>,
  now: Date = new Date(),
): { ok: true; value: NotePatch } | { ok: false; error: string } {
  const update: Record<string, unknown> = {}
  let taskOnly = false
  if (body.body !== undefined) {
    const text = typeof body.body === "string" ? body.body.trim() : ""
    if (text.length === 0) return { ok: false, error: "Le texte ne peut pas être vide." }
    if (text.length > BODY_MAX) return { ok: false, error: "Le texte est trop long (4 000 caractères au plus)." }
    update.body = text
  }
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") return { ok: false, error: "État invalide." }
    update.done_at = body.done ? now.toISOString() : null
    taskOnly = true
  }
  if (body.due_date !== undefined) {
    if (body.due_date === null || body.due_date === "") update.due_at = null
    else if (isIsoDay(body.due_date)) update.due_at = dueAtOf(body.due_date)
    else return { ok: false, error: "Échéance invalide." }
    taskOnly = true
  }
  if (Object.keys(update).length === 0) return { ok: false, error: "Rien à modifier." }
  return { ok: true, value: { update, taskOnly } }
}

/** Tâche à faire dont l'échéance est passée. */
export function isLate(note: WorkNote, today: string): boolean {
  return note.kind === "task" && !note.done_at && note.due_date !== null && note.due_date < today
}

/**
 * Ordre d'affichage : tâches ouvertes (en retard d'abord, puis par échéance, sans
 * échéance en dernier), puis notes de la plus récente à la plus ancienne ; les
 * tâches faites séparément.
 */
export function splitNotes(notes: WorkNote[]): { open: WorkNote[]; done: WorkNote[]; texts: WorkNote[] } {
  const open = notes
    .filter((n) => n.kind === "task" && !n.done_at)
    .sort((a, b) => {
      if (!a.due_date !== !b.due_date) return a.due_date ? -1 : 1
      if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
      return a.created_at.localeCompare(b.created_at)
    })
  const done = notes.filter((n) => n.kind === "task" && n.done_at).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)))
  const texts = notes.filter((n) => n.kind === "note").sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { open, done, texts }
}
