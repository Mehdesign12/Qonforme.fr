/**
 * Lecture complète d'une liste par tranches de 1 000 lignes (plafond par
 * défaut de PostgREST côté Supabase). La requête doit trier sur un ordre
 * unique (l'identifiant en dernier critère) : sinon deux tranches peuvent
 * sauter ou doubler des lignes. Au-delà de `maxRows`, la lecture échoue au
 * lieu de rendre une liste tronquée en silence.
 */
import { must, SeoDbError } from "@/lib/seo/db"

export const PAGE_SIZE = 1000
export const MAX_ROWS = 50_000

type PageResult = { data: unknown; error: { code?: string | null; message?: string | null } | null }

export async function readAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  what: string,
  opts: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const size = opts.pageSize ?? PAGE_SIZE
  const max = opts.maxRows ?? MAX_ROWS
  const out: T[] = []
  for (let from = 0; ; from += size) {
    if (from >= max) throw new SeoDbError("read_failed", `Lecture incomplète : ${what} dépassent ${max} lignes`)
    const rows = (must(await page(from, from + size - 1), what) as T[] | null) ?? []
    rows.forEach((r) => out.push(r))
    if (rows.length < size) return out
  }
}
