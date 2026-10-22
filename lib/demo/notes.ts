/**
 * Notes et tâches fictives de la démo (miroir du panneau « À faire et notes »).
 * Gardées en mémoire par page : rien n'est enregistré.
 */
import { DEMO_CLIENTS, DEMO_SUB_CHANTIER_ID, DEMO_TODAY } from "@/lib/demo/data"
import { addDays } from "@/lib/utils/paris-date"
import type { NoteScope, NotesApi } from "@/components/planning/NotesPanel"
import { parseNoteInput, remindAtOf, type WorkNote } from "@/lib/planning/notes"

const name = (id: string | null) => (id ? DEMO_CLIENTS.find((c) => c.id === id)?.name ?? null : null)

function note(
  id: string, kind: WorkNote["kind"], body: string, extra: Partial<WorkNote> & { daysAgo?: number } = {},
): WorkNote {
  const { daysAgo = 0, ...rest } = extra
  return {
    id, kind, body, due_date: null, done_at: null, remind_at: null, client_id: null, client_name: null, chantier_id: null,
    created_at: `${addDays(DEMO_TODAY, -daysAgo)}T10:00:00.000Z`, ...rest,
  }
}

export const DEMO_NOTES: WorkNote[] = [
  note("n1", "task", "Commander les huisseries du bâtiment B", { due_date: addDays(DEMO_TODAY, 1), chantier_id: DEMO_SUB_CHANTIER_ID, client_id: "arvel", client_name: name("arvel"), daysAgo: 2 }),
  note("n2", "task", "Valider le calepinage avec le conducteur de travaux", { due_date: addDays(DEMO_TODAY, -1), chantier_id: DEMO_SUB_CHANTIER_ID, client_id: "arvel", client_name: name("arvel"), daysAgo: 5 }),
  note("n3", "task", "Rappeler Mme Lambert pour le devis salle de bain", { due_date: DEMO_TODAY, client_id: "lambert", client_name: name("lambert"), daysAgo: 1 }),
  note("n4", "task", "Couper l'eau avec le syndic", { done_at: `${addDays(DEMO_TODAY, -1)}T16:00:00.000Z`, chantier_id: DEMO_SUB_CHANTIER_ID, client_id: "arvel", client_name: name("arvel"), daysAgo: 6 }),
  note("n5", "note", "Mur côté cage d'escalier humide : prévoir un traitement avant les cloisons.", { chantier_id: DEMO_SUB_CHANTIER_ID, client_id: "arvel", client_name: name("arvel"), daysAgo: 3 }),
  note("n6", "note", "Accès par la rue de derrière, code du portail 4217 (à ne pas donner aux livreurs).", { client_id: "lambert", client_name: name("lambert"), daysAgo: 4 }),
  note("n7", "task", "Acheter des vis inox pour la terrasse", { daysAgo: 0 }),
]

/** API en mémoire de la démo : un magasin par page. */
export function demoNotesApi(): NotesApi {
  let store = [...DEMO_NOTES]
  let seq = 100
  return {
    async list(scope: NoteScope) {
      let list = store
      if (scope.chantier_id) list = list.filter((n) => n.chantier_id === scope.chantier_id)
      else if (scope.client_id) list = list.filter((n) => n.client_id === scope.client_id)
      if (scope.openOnly) list = list.filter((n) => n.kind === "task" && !n.done_at)
      return { available: true, today: DEMO_TODAY, notes: list }
    },
    async create(input) {
      // La démo n'envoie rien : le rappel est seulement montré (pas de contrôle d'heure passée sur la date fictive)
      const parsed = parseNoteInput({ ...input, remind: null })
      if (!parsed.ok) throw new Error(parsed.error)
      const created: WorkNote = {
        id: `demo-note-${++seq}`, kind: parsed.value.kind, body: parsed.value.body, due_date: input.due_date,
        done_at: null, remind_at: input.due_date && input.remind ? remindAtOf(input.due_date, input.remind) : null, client_id: input.client_id, client_name: name(input.client_id), chantier_id: input.chantier_id,
        created_at: new Date().toISOString(),
      }
      store = [created, ...store]
      return created
    },
    async patch(id, patch) {
      const found = store.find((n) => n.id === id)
      if (!found) throw new Error("Note introuvable")
      const next = {
        ...found,
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.done !== undefined ? { done_at: patch.done ? new Date().toISOString() : null } : {}),
        ...(patch.due_date !== undefined ? { due_date: patch.due_date } : {}),
      }
      store = store.map((n) => (n.id === id ? next : n))
      return next
    },
    async remove(id) { store = store.filter((n) => n.id !== id) },
  }
}
