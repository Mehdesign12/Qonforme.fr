/**
 * POST /api/admin/seo/connections/test { key } → { result, stored }
 *
 * Teste une connexion de l'onglet SEO par un appel léger et réel au service
 * (lib/seo/connections-test.ts) et garde le résultat dans seo_settings
 * (« connections_test:<connexion> »). Le test de PageSpeed lance une vraie mesure de
 * l'accueil : jusqu'à 90 s. Le message rendu ne contient jamais de clé.
 * Admin seulement.
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { CONNECTIONS, type ConnectionKey } from "@/lib/seo/connections"
import { storeConnectionTest, testConnection } from "@/lib/seo/connections-test"
import { seoDb } from "@/lib/seo/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const keys = CONNECTIONS.map((c) => c.key) as [ConnectionKey, ...ConnectionKey[]]
const bodySchema = z.object({ key: z.enum(keys) })

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Connexion inconnue" }, { status: 400 })

  const result = await testConnection(parsed.data.key)
  let stored = true
  try {
    await storeConnectionTest(seoDb(), parsed.data.key, result)
  } catch (error) {
    // Le résultat reste utile même si la base ne peut pas le garder (migration absente, coupure)
    stored = false
    console.error("[seo-connections] résultat du test non enregistré", error instanceof Error ? error.message : "erreur")
  }
  return NextResponse.json({ result, stored })
}
