import { NextResponse } from "next/server"
import { analyserNomFichier, genererFichierModele } from "@/lib/modeles/fichier"

/**
 * Modèles de devis à télécharger (Word, Excel, PDF) : GET /api/outils/modeles/modele-devis-artisan.docx
 * Contenu identique pour tous les visiteurs, donc mis en cache par le réseau (un jour).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ fichier: string }> | { fichier: string } }) {
  const { fichier } = await params
  const demande = analyserNomFichier(fichier)
  if (!demande) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 })

  const f = await genererFichierModele(demande.options, demande.format)
  return new NextResponse(Buffer.from(f.data), {
    headers: {
      "Content-Type": f.type,
      "Content-Disposition": `attachment; filename="${f.nom}"`,
      "Content-Length": String(f.data.length),
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
