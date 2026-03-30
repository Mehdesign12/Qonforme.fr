/**
 * Scraping d'emails depuis les sites web des prospects
 *
 * Pour chaque prospect ayant un `site_web`, on scrape :
 * 1. La page d'accueil
 * 2. /contact, /mentions-legales, /a-propos (si existantes)
 * 3. Extraction via regex + filtrage + priorisation
 *
 * Contraintes :
 * - Timeout 5s par requête
 * - Max 10 requêtes simultanées (pool de concurrence)
 * - User-Agent honnête
 * - Respect robots.txt
 */

import { createAdminClient } from "@/lib/supabase/server"

const USER_AGENT = "Qonforme-Bot/1.0 (+https://qonforme.fr)"
const FETCH_TIMEOUT = 5000
const MAX_CONCURRENT = 10

// Pages à scraper (en plus de la page d'accueil)
const SUBPAGES = ["/contact", "/mentions-legales", "/a-propos", "/about", "/legal", "/contactez-nous"]

// Emails génériques à ignorer
const IGNORED_PREFIXES = [
  "noreply", "no-reply", "mailer-daemon", "postmaster", "webmaster",
  "abuse", "hostmaster", "root", "admin@localhost", "test@",
  "exemple@", "example@", "spam@", "newsletter@",
]

// Priorité des préfixes email (plus bas = meilleur)
const EMAIL_PRIORITY: Record<string, number> = {
  "contact": 1,
  "info": 2,
  "direction": 3,
  "commercial": 4,
  "bonjour": 5,
  "hello": 6,
  "accueil": 7,
}

// Regex email
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// ── Utilitaires ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    })

    clearTimeout(timer)

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("text/html")) return null

    // Limiter à 500KB pour éviter les pages trop lourdes
    const text = await response.text()
    return text.slice(0, 500_000)
  } catch {
    return null
  }
}

async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const html = await fetchWithTimeout(`${baseUrl}/robots.txt`, 3000)
    if (!html) return true // Pas de robots.txt = autorisé

    // Vérification simplifiée : chercher "Disallow: /" pour notre bot ou *
    const lines = html.toLowerCase().split("\n")
    let appliesToUs = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.replace("user-agent:", "").trim()
        appliesToUs = agent === "*" || agent.includes("qonforme")
      }
      if (appliesToUs && trimmed === "disallow: /") {
        return false // Tout le site est interdit
      }
    }

    return true
  } catch {
    return true // En cas d'erreur, on suppose que c'est autorisé
  }
}

function normalizeUrl(siteWeb: string): string {
  let url = siteWeb.trim()
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
  }
  // Retirer le trailing slash
  return url.replace(/\/+$/, "")
}

function extractEmails(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) ?? []

  // Dédupliquer et normaliser
  const unique = Array.from(new Set(matches.map((e) => e.toLowerCase())))

  // Filtrer les indésirables
  return unique.filter((email) => {
    // Ignorer les emails avec des extensions de fichiers
    if (/\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf)$/i.test(email)) return false

    // Ignorer les préfixes génériques
    const prefix = email.split("@")[0]
    if (IGNORED_PREFIXES.some((p) => prefix.startsWith(p))) return false

    // Ignorer les domaines d'exemple
    const domain = email.split("@")[1]
    if (["example.com", "example.fr", "test.com", "localhost"].includes(domain)) return false

    return true
  })
}

function pickBestEmail(emails: string[]): string | null {
  if (emails.length === 0) return null
  if (emails.length === 1) return emails[0]

  // Trier par priorité de préfixe
  const scored = emails.map((email) => {
    const prefix = email.split("@")[0]
    const priority = EMAIL_PRIORITY[prefix] ?? 99
    return { email, priority }
  })

  scored.sort((a, b) => a.priority - b.priority)
  return scored[0].email
}

// ── Scraping d'un site ─────────────────────────────────────────────────────────

export interface ScrapeResult {
  prospectId: string
  siteWeb: string
  email: string | null
  allEmails: string[]
  error?: string
}

async function scrapeOneSite(prospectId: string, siteWeb: string): Promise<ScrapeResult> {
  const baseUrl = normalizeUrl(siteWeb)

  // Vérifier robots.txt
  const allowed = await checkRobotsTxt(baseUrl)
  if (!allowed) {
    return { prospectId, siteWeb, email: null, allEmails: [], error: "robots.txt interdit" }
  }

  const allEmails: string[] = []

  // Scraper la page d'accueil + sous-pages
  const pagesToScrape = [baseUrl, ...SUBPAGES.map((p) => `${baseUrl}${p}`)]

  for (const pageUrl of pagesToScrape) {
    const html = await fetchWithTimeout(pageUrl)
    if (html) {
      const emails = extractEmails(html)
      allEmails.push(...emails)
    }
  }

  // Dédupliquer
  const uniqueEmails = Array.from(new Set(allEmails))
  const bestEmail = pickBestEmail(uniqueEmails)

  return { prospectId, siteWeb, email: bestEmail, allEmails: uniqueEmails }
}

// ── Pool de concurrence ────────────────────────────────────────────────────────

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++
      results[currentIndex] = await fn(items[currentIndex])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ── Orchestration batch ────────────────────────────────────────────────────────

export interface EmailScrapeBatchResult {
  total: number
  scraped: number
  found: number
  errors: number
  durationMs: number
}

export async function scrapeEmailsBatch(
  batchSize: number = 100,
): Promise<EmailScrapeBatchResult> {
  const supabase = createAdminClient()
  const startTime = Date.now()

  // Prospects avec site_web mais sans email
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, site_web")
    .not("site_web", "is", null)
    .is("email", null)
    .limit(batchSize)

  if (!prospects || prospects.length === 0) {
    return { total: 0, scraped: 0, found: 0, errors: 0, durationMs: Date.now() - startTime }
  }

  // Scraper en parallèle (max 10 simultanés)
  const results = await runPool(
    prospects as { id: string; site_web: string }[],
    MAX_CONCURRENT,
    (p) => scrapeOneSite(p.id, p.site_web),
  )

  // Mettre à jour les prospects avec les emails trouvés
  let found = 0
  let errors = 0

  for (const result of results) {
    if (result.error) {
      errors++
      continue
    }

    if (result.email) {
      const { error } = await supabase
        .from("prospects")
        .update({
          email: result.email,
          email_source: "scraping",
          date_enrichment: new Date().toISOString(),
        })
        .eq("id", result.prospectId)

      if (error) {
        errors++
      } else {
        found++
      }
    }
  }

  // Log dans scraping_runs
  const durationMs = Date.now() - startTime
  await supabase.from("scraping_runs").insert({
    type: "email_scrape",
    total_found: found,
    total_inserted: found,
    total_skipped: prospects.length - found,
    duration_ms: durationMs,
    status: "completed",
  })

  return {
    total: prospects.length,
    scraped: prospects.length - errors,
    found,
    errors,
    durationMs,
  }
}
