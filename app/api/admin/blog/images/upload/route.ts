/**
 * POST /api/admin/blog/images/upload — import d'une image dans l'éditeur du
 * blog (couverture ou image du texte).
 *
 * Corps : multipart/form-data, champ « file ». Réponse : StoredImage
 * (adresse publique avec les dimensions dans le fragment).
 *
 * - 401 hors session admin ;
 * - 413 au-delà de 5 Mo : refusé dès l'en-tête Content-Length quand il est
 *   annoncé (le corps n'est pas lu), puis sur la taille réelle du fichier ;
 * - 415 si le contenu n'est pas une image JPEG, PNG ou WebP, quelle que soit
 *   son extension ou le type annoncé (lib/blog-images/sniff.ts) ;
 * - 503 si le stockage refuse l'envoi (réessayable).
 */
import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import { MAX_UPLOAD_BYTES } from "@/lib/blog-images/policy"
import { BlogImageError, SIZE_ERROR_MESSAGE, TYPE_ERROR_MESSAGE, storeBlogImage } from "@/lib/blog-images/server"
import { sniffImage } from "@/lib/blog-images/sniff"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

/** Enveloppe multipart (limites, en-têtes de la partie) en plus du fichier. */
const MULTIPART_OVERHEAD = 64 * 1024

/** Nom du fichier sans extension ni chemin : il forme le nom enregistré. */
function hintOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ""
  return base.replace(/\.[a-z0-9]{1,5}$/i, "").slice(0, 80) || "image"
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const announced = Number(request.headers.get("content-length") ?? "")
  if (Number.isFinite(announced) && announced > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD) {
    return NextResponse.json({ error: SIZE_ERROR_MESSAGE, code: "size" }, { status: 413 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Envoyez l'image dans le champ « file »." }, { status: 400 })
  }
  const file = form.get("file")
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Envoyez l'image dans le champ « file »." }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: SIZE_ERROR_MESSAGE, code: "size" }, { status: 413 })

  const data = Buffer.from(await file.arrayBuffer())
  if (data.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: SIZE_ERROR_MESSAGE, code: "size" }, { status: 413 })
  if (data.length === 0 || !sniffImage(data)) return NextResponse.json({ error: TYPE_ERROR_MESSAGE, code: "type" }, { status: 415 })

  try {
    const image = await storeBlogImage({ data, hint: hintOf((file as File).name ?? "") })
    return NextResponse.json(image)
  } catch (error) {
    if (error instanceof BlogImageError) {
      const status = error.code === "type" ? 415 : error.code === "size" ? 413 : 503
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error("[blog-images] import en échec", error)
    return NextResponse.json({ error: "L'image n'a pas pu être importée. Réessayez dans un instant." }, { status: 500 })
  }
}
