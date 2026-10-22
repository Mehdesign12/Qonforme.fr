"use client"

/**
 * « À faire » du tableau de bord, côté tâches : tâches ouvertes de l'artisan
 * (notes et planning). Rien tant qu'il n'y en a pas, ou si la fonction n'est pas
 * activée : le tableau de bord ne saute pas. Distinct de « À faire » des
 * factures (TodoCard), dont les lignes viennent des documents.
 */
import { useMemo } from "react"
import { NotesPanel } from "@/components/planning/NotesPanel"
import { demoNotesApi } from "@/lib/demo/notes"
import { appNotesApi } from "@/lib/planning/notes-api"

export function OpenTasksCard({ mode }: { mode: "app" | "demo" }) {
  const api = useMemo(() => (mode === "demo" ? demoNotesApi() : appNotesApi), [mode])
  return (
    <div className="empty:hidden">
      <NotesPanel api={api} scope={{ openOnly: true }} compact hideWhenEmpty title="Mes tâches" />
    </div>
  )
}
