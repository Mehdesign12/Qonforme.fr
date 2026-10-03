/**
 * Factures reçues des fournisseurs.
 *
 * GET  : liste (propriétaire seulement, RLS) ; `available: false` tant que la
 *        migration 20261003_received_invoices.sql n'est pas appliquée.
 * POST : import d'un fichier (PDF Factur-X, XML CII ou UBL, ou PDF simple avec
 *        saisie manuelle). Le fichier est relu ici, jamais l'analyse du
 *        navigateur ; contrôles bloquants (données indispensables, destinataire,
 *        doublon) appliqués avant toute écriture.
 *
 * Pas de mur de paiement : recevoir ses factures est une obligation légale
 * pour toutes les entreprises depuis le 1er septembre 2026 (CGI, art. 289 bis ;
 * DGFiP, guide pratique de démarrage, juillet 2026).
 */
import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prepareUpload } from "@/lib/reception/prepare"
import {
  LIST_COLUMNS, RECEIVED_TABLE, companySirenOf, findDuplicate, isReceptionUnavailable,
  persistReceivedInvoice, safeFileName, toListItem,
} from "@/lib/reception/server"
import { readUpload } from "@/lib/reception/upload"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data, error } = await supabase
    .from(RECEIVED_TABLE)
    .select(LIST_COLUMNS)
    .eq("user_id", user.id)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000)

  if (error) {
    if (isReceptionUnavailable(error)) return NextResponse.json({ available: false, invoices: [] })
    console.error("[received-invoices] liste:", error.message)
    return NextResponse.json({ error: "Impossible de charger les factures reçues." }, { status: 500 })
  }
  return NextResponse.json({ available: true, invoices: (data ?? []).map((r) => toListItem(r as Record<string, unknown>)) })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const upload = await readUpload(request)
  if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: upload.status })

  const state = { unavailable: false }
  const companySiren = await companySirenOf(supabase, user.id)
  const prepared = await prepareUpload(upload.bytes, {
    companySiren,
    manual: upload.manual,
    findDuplicate: async (record) => {
      const r = await findDuplicate(supabase, user.id, record)
      state.unavailable = state.unavailable || r.unavailable
      return r.duplicate
    },
  })
  if (state.unavailable) {
    return NextResponse.json({ error: "La réception des factures n'est pas encore activée.", code: "RECEPTION_UNAVAILABLE" }, { status: 503 })
  }
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error, code: prepared.code, field: prepared.field }, { status: prepared.status })
  }
  if (prepared.kind === "pdf_only") {
    return NextResponse.json({ error: "Ce PDF ne contient pas de facture électronique : complétez la saisie.", code: "MANUAL_REQUIRED" }, { status: 422 })
  }
  if (prepared.blocking || !prepared.record) {
    const first = prepared.checks.find((c) => c.level === "error")
    return NextResponse.json(
      { error: first ? `${first.title}. ${first.detail ?? ""}`.trim() : "Facture incomplète.", code: "BLOCKING_CHECK", checks: prepared.checks },
      { status: 422 },
    )
  }

  const saved = await persistReceivedInvoice(supabase, {
    userId: user.id,
    record: prepared.record,
    checks: prepared.checks,
    file: {
      bytes: upload.bytes,
      kind: prepared.fileKind,
      name: safeFileName(upload.name, prepared.fileKind),
      sha256: createHash("sha256").update(upload.bytes).digest("hex"),
    },
    hasPdf: prepared.hasPdf,
    source: "import",
  })
  if (!saved.ok) {
    const status = saved.reason === "unavailable" ? 503 : saved.reason === "duplicate" ? 409 : 500
    return NextResponse.json({ error: saved.message, code: saved.reason === "unavailable" ? "RECEPTION_UNAVAILABLE" : undefined }, { status })
  }
  return NextResponse.json({ id: saved.id }, { status: 201 })
}
