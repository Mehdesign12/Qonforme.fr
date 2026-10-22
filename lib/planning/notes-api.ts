/** Accès aux routes /api/notes depuis le navigateur (l'équivalent en mémoire de la démo : lib/demo/notes.ts). */
import type { NoteScope, NotesApi } from "@/components/planning/NotesPanel"
import type { WorkNote } from "@/lib/planning/notes"

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "Erreur réseau")
  return json as T
}

const send = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})

export const appNotesApi: NotesApi = {
  async list(scope: NoteScope) {
    const q = new URLSearchParams()
    if (scope.chantier_id) q.set("chantier_id", scope.chantier_id)
    else if (scope.client_id) q.set("client_id", scope.client_id)
    if (scope.openOnly) q.set("open", "1")
    const res = await call<{ available?: boolean; today?: string; notes?: WorkNote[] }>(`/api/notes?${q}`)
    return { available: res.available !== false, today: res.today ?? "", notes: res.notes ?? [] }
  },
  async create(input) { return (await call<{ note: WorkNote }>("/api/notes", send("POST", input))).note },
  async patch(id, patch) { return (await call<{ note: WorkNote }>(`/api/notes/${id}`, send("PATCH", patch))).note },
  async remove(id) { await call(`/api/notes/${id}`, { method: "DELETE" }) },
}
