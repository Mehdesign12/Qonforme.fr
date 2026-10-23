/**
 * Télécharge un document scanné en PDF (une page d'image par page scannée).
 * Les pages sont relues dans le stockage privé du compte, remises en JPEG puis
 * assemblées sans dépendance autre que pdf-lib ; le PDF n'est pas conservé.
 */
import { NextRequest, NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"
import { createClient } from "@/lib/supabase/server"
import { documentName, SCAN_KIND_LABELS, type ScanKind } from "@/lib/scan/documents"
import { SCAN_BUCKET } from "@/lib/scan/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Largeur d'une page A4 en points PDF. */
const PAGE_WIDTH = 595

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: doc, error } = await supabase
    .from("scanned_documents")
    .select("id, kind, title, supplier, doc_number, pages:scanned_document_pages(position, storage_path)")
    .eq("id", id).eq("user_id", user.id).maybeSingle()
  if (error) return NextResponse.json({ error: "Impossible de préparer le PDF." }, { status: 500 })
  const row = doc as unknown as { kind: ScanKind; title: string | null; supplier: string | null; doc_number: string | null; pages: { position: number; storage_path: string }[] } | null
  if (!row) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const pages = (row.pages ?? []).slice().sort((a, b) => a.position - b.position)
  if (pages.length === 0) return NextResponse.json({ error: "Ce document n'a pas de page." }, { status: 409 })

  let sharp: typeof import("sharp").default
  try {
    const mod = (await import("sharp")) as unknown as { default?: typeof import("sharp").default } & typeof import("sharp").default
    sharp = (typeof mod.default === "function" ? mod.default : mod) as typeof import("sharp").default
  } catch {
    return NextResponse.json({ error: "Le PDF est indisponible pour le moment. Réessayez plus tard." }, { status: 503 })
  }

  const pdf = await PDFDocument.create()
  for (const page of pages) {
    const file = await supabase.storage.from(SCAN_BUCKET).download(page.storage_path)
    if (file.error || !file.data) return NextResponse.json({ error: "Une page n'a pas pu être lue. Réessayez." }, { status: 502 })
    const jpeg = await sharp(Buffer.from(await file.data.arrayBuffer())).jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true })
    const image = await pdf.embedJpg(jpeg.data)
    const height = Math.round((PAGE_WIDTH * jpeg.info.height) / jpeg.info.width)
    const p = pdf.addPage([PAGE_WIDTH, height])
    p.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height })
  }
  const name = documentName({ supplier: row.supplier, title: row.title, kind: row.kind })
  pdf.setTitle(`${SCAN_KIND_LABELS[row.kind]} ${row.doc_number ?? ""}`.trim())
  const bytes = await pdf.save()
  const filename = `${[SCAN_KIND_LABELS[row.kind], name !== SCAN_KIND_LABELS[row.kind] ? name : "", row.doc_number ?? ""].filter(Boolean).join(" ").replace(/[^A-Za-z0-9\u00C0-\u00FF ._-]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "document"}.pdf`
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
