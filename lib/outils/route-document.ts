import { NextRequest, NextResponse } from "next/server"
import { nomFichier, validerDocument, type TypeDocument } from "./document"
import { genererPdfDocument } from "./pdf-document"

/** Corps JSON accepté au plus (200 lignes de 1 000 caractères tiennent largement). */
const TAILLE_MAX = 512 * 1024

/**
 * POST commun de /api/outils/facture et /api/outils/devis : valide la saisie
 * (400 avec un message explicite, jamais 500 pour une saisie fautive) puis
 * renvoie le PDF.
 */
export async function repondrePdf(request: NextRequest, type: TypeDocument): Promise<NextResponse> {
  const longueur = Number(request.headers.get("content-length") ?? 0)
  if (longueur > TAILLE_MAX) return NextResponse.json({ error: "Document trop volumineux." }, { status: 413 })

  let texte: string
  try {
    texte = await request.text()
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 })
  }
  if (texte.length > TAILLE_MAX) return NextResponse.json({ error: "Document trop volumineux." }, { status: 413 })

  let corps: unknown
  try {
    corps = JSON.parse(texte)
  } catch {
    return NextResponse.json({ error: "Données invalides : JSON attendu." }, { status: 400 })
  }

  const v = validerDocument(corps, type)
  if (!v.ok) return NextResponse.json({ error: v.erreur }, { status: 400 })

  const pdf = await genererPdfDocument(v.document)
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier(type, v.document.numero)}"`,
      "Cache-Control": "no-store",
    },
  })
}
