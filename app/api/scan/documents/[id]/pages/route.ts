/**
 * Ajoute une page à un document scanné (une page par requête : un document de
 * plusieurs pages dépasserait la limite de 4,5 Mo des fonctions serveur).
 *
 * Le fichier reçu est contrôlé à ses octets (JPEG, PNG ou WebP, jamais l'extension),
 * remis d'aplomb, débarrassé de ses métadonnées (position GPS comprise) et
 * recompressé en WebP par sharp : jamais l'original gardé tel quel. Refusé
 * (409 SCAN_QUOTA) s'il dépasse l'espace du compte. Logique commune avec le scan
 * depuis un téléphone appairé : lib/scan/service.ts.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { addScanPage } from "@/lib/scan/service"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Document introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 })
  const result = await addScanPage(supabase, user.id, id, form.get("file"), Number(form.get("position")))
  return NextResponse.json(result.body, { status: result.status })
}
