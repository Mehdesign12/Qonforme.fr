/** Résultats de la palette de recherche (⌘K) */
export interface SearchResults {
  clients:  { id: string; name: string; sub: string }[]
  invoices: { id: string; number: string; client: string; amount: number; status: string }[]
  quotes:   { id: string; number: string; client: string; amount: number; status: string }[]
}

export const EMPTY_RESULTS: SearchResults = { clients: [], invoices: [], quotes: [] }

/** Minuscules sans accents, pour comparer « électricité » et « Electricite » */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/** Échappe % _ et \ pour un motif ILIKE (la saisie reste du texte, jamais un motif) */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`
}
