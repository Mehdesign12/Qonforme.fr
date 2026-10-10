"use client"

/**
 * Tableau « Pages » ou « Requêtes » de Performance › Recherche Google :
 * recherche dans la liste reçue, tri par colonne (impressions décroissantes par
 * défaut), 50 lignes puis « Afficher plus ». Jamais de ligne de total ni
 * « autres pages ». Sur téléphone : lignes de liste au lieu du tableau.
 */
import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react"
import { SearchField } from "@/components/app/kit"
import { cn } from "@/lib/utils"
import { fmtCount, fmtPosition, fmtRate } from "@/lib/seo/format"
import { siteUrl } from "@/lib/seo/site"
import { Val } from "@/components/admin/seo/performance/Value"

export interface GscTableRow {
  key: string
  clicks: number
  impressions: number
  ctr: number | null
  position: number | null
}

type SortKey = "clicks" | "impressions" | "ctr" | "position"
type SortDir = "asc" | "desc"

const PAGE_SIZE = 50

const COLUMNS: { key: SortKey; label: string; title?: string; spoken?: string }[] = [
  { key: "clicks", label: "Clics" },
  { key: "impressions", label: "Impressions" },
  { key: "ctr", label: "CTR", title: "CTR : taux de clic", spoken: "Taux de clic" },
  { key: "position", label: "Position" },
]

/** Abréviation visible, mot complet pour les lecteurs d'écran. */
function Abbr({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span aria-hidden>{short}</span>
      <span className="sr-only">{full}</span>
    </>
  )
}

/** Minuscules sans accents, pour la recherche. */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function compareRows(a: GscTableRow, b: GscTableRow, key: SortKey, dir: SortDir): number {
  const va = a[key]
  const vb = b[key]
  // Valeur absente toujours en bas, quel que soit le sens
  if (va === null && vb === null) return 0
  if (va === null) return 1
  if (vb === null) return -1
  const diff = dir === "asc" ? va - vb : vb - va
  return diff !== 0 ? diff : b.impressions - a.impressions || a.key.localeCompare(b.key, "fr")
}

function cell(key: SortKey, row: GscTableRow): string {
  switch (key) {
    case "clicks":
      return fmtCount(row.clicks)
    case "impressions":
      return fmtCount(row.impressions)
    case "ctr":
      return fmtRate(row.ctr)
    case "position":
      return fmtPosition(row.position)
  }
}

export function GscTable({
  kind,
  rows,
  caption,
  searchPlaceholder,
  truncated,
}: {
  kind: "page" | "query"
  rows: GscTableRow[]
  /** Nom accessible du tableau (« Pages classées par impressions »). */
  caption: string
  searchPlaceholder: string
  /** Vrai si la liste reçue a atteint le plafond de lignes du serveur. */
  truncated?: boolean
}) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "impressions", dir: "desc" })
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    const list = q ? rows.filter((r) => normalize(r.key).includes(q)) : rows.slice()
    return list.sort((a, b) => compareRows(a, b, sort.key, sort.dir))
  }, [rows, query, sort])

  const shown = filtered.slice(0, visible)
  const noun = kind === "page" ? "page" : "requête"

  const toggleSort = (key: SortKey) => {
    setVisible(PAGE_SIZE)
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "position" ? "asc" : "desc" }))
  }

  const keyCell = (row: GscTableRow) =>
    kind === "page" ? (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate font-mono text-[13px]">{row.key}</span>
        <a
          href={siteUrl(row.key)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ouvrir ${row.key} sur qonforme.fr (nouvel onglet)`}
          className="-my-2 inline-grid size-11 shrink-0 place-items-center rounded-md text-[var(--q-text-4)] hover:bg-[var(--q-hover)] hover:text-[var(--q-accent-strong)] md:my-0 md:size-7"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </span>
    ) : (
      <span className="block min-w-0 truncate">{row.key}</span>
    )

  return (
    <div className="flex flex-col">
      <div className="px-4 pb-3 md:px-5">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v)
            setVisible(PAGE_SIZE)
          }}
          placeholder={searchPlaceholder}
          className="w-full md:max-w-[340px]"
        />
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-[var(--q-line-soft)] px-4 py-8 text-center text-sm text-[var(--q-text-4)] md:px-5">
          Aucune {noun} avec des impressions sur cette période.
        </p>
      ) : filtered.length === 0 ? (
        <p role="status" className="border-t border-[var(--q-line-soft)] px-4 py-8 text-center text-sm text-[var(--q-text-4)] md:px-5">
          Aucune {noun} ne correspond à « {query.trim()} ».
        </p>
      ) : (
        <>
          {/* Ordinateur et tablette : tableau */}
          <div className="hidden overflow-x-auto md:block">
            <table className="q-table" aria-label={caption}>
              <thead>
                <tr>
                  <th scope="col">{kind === "page" ? "Page" : "Requête"}</th>
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key
                    const Icon = active ? (sort.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        className="text-right"
                        aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          title={c.title}
                          className={cn(
                            "inline-flex items-center gap-1 rounded text-xs",
                            active ? "font-semibold text-[var(--q-ink)]" : "font-medium text-[var(--q-text-4)] hover:text-[var(--q-ink)]",
                          )}
                        >
                          {c.spoken ? <Abbr short={c.label} full={c.spoken} /> : c.label}
                          <Icon className="size-3.5" aria-hidden />
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" className="max-w-[520px] text-left font-normal">
                      {keyCell(row)}
                    </th>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className={cn("q-num whitespace-nowrap", sort.key === c.key && "font-semibold")}>
                        <Val text={cell(c.key, row)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Téléphone : lignes de liste */}
          <ul className="q-list border-t border-[var(--q-line-soft)] md:hidden" aria-label={caption}>
            {shown.map((row) => (
              <li key={row.key} className="flex min-h-[60px] flex-col justify-center gap-1 px-4 py-3">
                {keyCell(row)}
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] tabular-nums text-[var(--q-text-4)]">
                  <span>
                    <span className="text-[var(--q-text-3)]">
                      <Abbr short="Impr." full="Impressions" />
                    </span>{" "}
                    <span className="font-semibold text-[var(--q-ink)]">{fmtCount(row.impressions)}</span>
                  </span>
                  <span>
                    <span className="text-[var(--q-text-3)]">Clics</span> {fmtCount(row.clicks)}
                  </span>
                  <span>
                    <span className="text-[var(--q-text-3)]">
                      <Abbr short="CTR" full="Taux de clic" />
                    </span>{" "}
                    <Val text={fmtRate(row.ctr)} />
                  </span>
                  <span>
                    <span className="text-[var(--q-text-3)]">
                      <Abbr short="Pos." full="Position" />
                    </span>{" "}
                    <Val text={fmtPosition(row.position)} />
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {filtered.length > visible && (
            <div className="flex justify-center border-t border-[var(--q-line-soft)] px-4 py-3">
              <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="q-btn q-btn-secondary h-12 w-full md:h-10 md:w-auto">
                Afficher plus
              </button>
            </div>
          )}
        </>
      )}

      {truncated && (
        <p className="border-t border-[var(--q-line-soft)] px-4 py-3 text-xs text-[var(--q-text-4)] md:px-5">
          Liste limitée aux 1 000 {kind === "page" ? "pages" : "requêtes"} qui ont le plus d&apos;impressions.
        </p>
      )}
    </div>
  )
}
