/**
 * GET /api/received-invoices/[id]/file — fichier d'origine d'une facture reçue.
 *
 * Propriétaire seulement (RLS sur la table et sur le bucket privé). Un XML est
 * toujours servi en téléchargement, sous une politique de sécurité qui
 * interdit tout script : un fichier déposé ne doit jamais s'exécuter dans
 * l'origine de Qonforme. Un PDF peut s'afficher dans la page (`?inline=1`),
 * seulement s'il commence vraiment par « %PDF- ».
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sniffKind } from "@/lib/reception/bytes"
import { RECEIVED_BUCKET, RECEIVED_TABLE, isReceptionUnavailable } from "@/lib/reception/server"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** En-tête Content-Disposition avec nom ASCII de repli et nom UTF-8 (RFC 6266, RFC 5987). */
function disposition(type: "inline" | "attachment", name: string): string {
  const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "facture"
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: row, error } = await supabase
    .from(RECEIVED_TABLE)
    .select("file_path, file_name, file_mime")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Fichier indisponible" }, { status: isReceptionUnavailable(error) ? 503 : 500 })
  if (!row?.file_path || !String(row.file_path).startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 })
  }

  const dl = await supabase.storage.from(RECEIVED_BUCKET).download(String(row.file_path))
  if (dl.error || !dl.data) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 })
  const bytes = new Uint8Array(await dl.data.arrayBuffer())
  const kind = sniffKind(bytes)
  const name = String(row.file_name ?? (kind === "pdf" ? "facture.pdf" : "facture.xml"))
  const wantsInline = new URL(request.url).searchParams.get("inline") === "1"

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(bytes.byteLength),
  })
  if (kind === "pdf") {
    headers.set("Content-Type", "application/pdf")
    headers.set("Content-Disposition", disposition(wantsInline ? "inline" : "attachment", name))
    headers.set("Content-Security-Policy", "frame-ancestors 'self'")
  } else {
    headers.set("Content-Type", "application/xml; charset=utf-8")
    headers.set("Content-Disposition", disposition("attachment", name))
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox; frame-ancestors 'none'")
  }
  return new NextResponse(bytes as unknown as BodyInit, { status: 200, headers })
}
