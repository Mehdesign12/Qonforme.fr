/**
 * GET /api/admin/seo/connections → { connections, tests, testsAvailable, testsFailure }
 *
 * État de présence de chaque connexion de l'onglet SEO (variables présentes
 * ou non, jamais leur valeur) et derniers résultats du bouton « Tester »
 * (seo_settings « connections_test:<connexion> »). Historique illisible :
 * testsFailure vaut « migration_pending » (base pas à jour) ou « read_failed »
 * (lecture en échec, à réessayer). Admin seulement.
 */
import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { connectionStatuses } from "@/lib/seo/connections"
import { readConnectionTests, type ConnectionTests } from "@/lib/seo/connections-test"
import { errorPayload, failureOf, seoDb, type SeoReadFailure } from "@/lib/seo/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const connections = connectionStatuses()
  let tests: ConnectionTests = {}
  let testsFailure: SeoReadFailure | null = null
  try {
    tests = await readConnectionTests(seoDb())
  } catch (error) {
    // La présence des variables ne dépend pas de la base : seul l'historique des tests manque
    testsFailure = failureOf(error)
    if (testsFailure === null) {
      const { status, body } = errorPayload(error)
      return NextResponse.json(body, { status })
    }
  }
  return NextResponse.json({ connections, tests, testsAvailable: testsFailure === null, testsFailure })
}
