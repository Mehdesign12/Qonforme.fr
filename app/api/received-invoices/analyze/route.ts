/**
 * POST /api/received-invoices/analyze — aperçu d'un fichier avant import.
 *
 * Lecture en mémoire et contrôles (destinataire, doublon, totaux, TVA) :
 * rien n'est écrit, ni en base ni dans le stockage. `available` dit si
 * l'enregistrement est possible (migration appliquée).
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prepareUpload } from "@/lib/reception/prepare"
import { companySirenOf, findDuplicate } from "@/lib/reception/server"
import { readUpload } from "@/lib/reception/upload"
import type { AnalyzeResponse } from "@/lib/reception/view"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const upload = await readUpload(request)
  if (!upload.ok) return NextResponse.json({ ok: false, error: upload.error }, { status: upload.status })

  const state = { unavailable: false }
  const prepared = await prepareUpload(upload.bytes, {
    companySiren: await companySirenOf(supabase, user.id),
    findDuplicate: async (record) => {
      const r = await findDuplicate(supabase, user.id, record)
      state.unavailable = state.unavailable || r.unavailable
      return r.duplicate
    },
  })

  let body: AnalyzeResponse
  if (!prepared.ok) body = { ok: false, error: prepared.error, code: prepared.code }
  else if (prepared.kind === "structured") {
    body = { ok: true, kind: "structured", format: prepared.format, invoice: prepared.invoice, checks: prepared.checks, blocking: prepared.blocking }
  } else if (prepared.kind === "pdf_only") body = { ok: true, kind: "pdf_only", format: "pdf", note: prepared.note }
  else body = { ok: false, error: "Analyse inattendue." }

  return NextResponse.json({ ...body, available: !state.unavailable }, { status: prepared.ok ? 200 : prepared.status })
}
