/**
 * Contrôle d'une page de partenaire : le lien vers qonforme.fr est-il là, et
 * avec quel attribut (suivi, nofollow, sponsored, ugc) ?
 *
 * Lancé à l'ajout d'une page, au clic sur « Vérifier » et chaque semaine par la
 * tâche planifiée (/api/cron/onboarding). Les adresses sont saisies par l'admin ;
 * par prudence, seuls http(s) et des noms de domaine publics sont ouverts
 * (ni adresse IP, ni localhost), 10 secondes et 2 Mo au plus.
 */
import { normalizePageUrl } from "@/lib/affiliation/model"

export type LinkRel = "follow" | "nofollow" | "sponsored" | "ugc"

export interface LinkCheckResult {
  ok: boolean
  /** Lien vers qonforme.fr trouvé dans la page. */
  found: boolean
  rel: LinkRel | null
  href: string | null
  /** Chemin de qonforme.fr visé par le lien trouvé. */
  targetPath: string | null
  error: string | null
}

const OUR_HOSTS = new Set(["qonforme.fr", "www.qonforme.fr"])
const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 10_000

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
}

/** Valeur d'un attribut d'une balise ouvrante (guillemets doubles, simples ou sans). */
function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  const m = tag.match(re)
  if (!m) return null
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? "")
}

/** Attribut le plus restrictif d'un lien : sponsored > nofollow > ugc > suivi. */
export function relOf(value: string | null): LinkRel {
  const parts = (value ?? "").toLowerCase().split(/\s+/)
  if (parts.includes("sponsored")) return "sponsored"
  if (parts.includes("nofollow")) return "nofollow"
  if (parts.includes("ugc")) return "ugc"
  return "follow"
}

/**
 * Liens vers qonforme.fr d'une page HTML. La page dit si elle est en
 * `<meta name="robots" content="nofollow">` : tous ses liens comptent alors comme nofollow.
 * Le lien suivi passe en premier quand il y en a plusieurs.
 */
export function findOurLinks(html: string, pageUrl: string): { href: string; rel: LinkRel; path: string }[] {
  const out: { href: string; rel: LinkRel; path: string }[] = []
  const metaNofollow = /<meta[^>]+name\s*=\s*["']?robots["']?[^>]*content\s*=\s*["'][^"']*nofollow/i.test(html)
  const tags = html.match(/<a\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const raw = attr(tag, "href")
    if (!raw) continue
    let url: URL
    try {
      url = new URL(raw, pageUrl)
    } catch {
      continue
    }
    if (!OUR_HOSTS.has(url.hostname.toLowerCase())) continue
    const rel = metaNofollow ? "nofollow" : relOf(attr(tag, "rel"))
    out.push({ href: url.toString(), rel, path: url.pathname || "/" })
  }
  return out.sort((a, b) => (a.rel === "follow" ? 0 : 1) - (b.rel === "follow" ? 0 : 1))
}

/** Adresse que le site accepte d'ouvrir : http(s), nom de domaine public. */
export function fetchableUrl(stored: string): string | null {
  const norm = normalizePageUrl(stored)
  if (!norm) return null
  const host = norm.split("/")[0]
  if (host === "localhost" || /\.(local|internal|localhost|lan|home)$/.test(host)) return null
  return `https://${norm}`
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return await res.text()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    chunks.push(value)
    if (size >= MAX_BYTES) {
      await reader.cancel().catch(() => undefined)
      break
    }
  }
  const all = new Uint8Array(Math.min(size, MAX_BYTES))
  let offset = 0
  for (const c of chunks) {
    const part = c.subarray(0, Math.max(0, all.length - offset))
    all.set(part, offset)
    offset += part.length
    if (offset >= all.length) break
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all)
}

export async function checkPartnerPage(stored: string, fetchImpl: typeof fetch = fetch): Promise<LinkCheckResult> {
  const url = fetchableUrl(stored)
  const fail = (error: string): LinkCheckResult => ({ ok: false, found: false, rel: null, href: null, targetPath: null, error })
  if (!url) return fail("Adresse non valide.")
  let res: Response
  try {
    res = await fetchImpl(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "QonformeLinkCheck/1.0 (+https://qonforme.fr)", Accept: "text/html,application/xhtml+xml" },
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    return fail(timedOut ? "La page n'a pas répondu à temps." : "Page injoignable.")
  }
  if (res.status === 404 || res.status === 410) return fail("Page introuvable (404).")
  if (!res.ok) return fail(`La page a répondu ${res.status}.`)
  const type = res.headers.get("content-type") ?? ""
  if (type && !/html/i.test(type)) return fail("Ce n'est pas une page web.")
  const html = await readCapped(res).catch(() => "")
  const links = findOurLinks(html, res.url || url)
  const first = links[0]
  return {
    ok: true,
    found: !!first,
    rel: first?.rel ?? null,
    href: first?.href ?? null,
    targetPath: first?.path ?? null,
    error: null,
  }
}

/** Nouvel état d'une page après un contrôle. Une page proposée reste proposée tant que le lien n'y est pas. */
export function nextPageStatus(
  current: "proposed" | "unchecked" | "found" | "missing" | "error",
  result: LinkCheckResult,
): "proposed" | "unchecked" | "found" | "missing" | "error" {
  if (!result.ok) return current === "proposed" ? "proposed" : "error"
  if (result.found) return "found"
  return current === "proposed" ? "proposed" : "missing"
}
