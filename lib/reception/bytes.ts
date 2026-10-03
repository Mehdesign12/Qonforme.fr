/**
 * Octets d'un fichier déposé : reconnaissance du type par son contenu (jamais
 * par l'extension ni par le type annoncé par le navigateur), décodage du texte
 * XML et décompression bornée.
 *
 * Fonctions sans API propre à Node : elles tournent aussi dans le navigateur.
 */

/** Taille maximale d'un fichier déposé : les fonctions Vercel refusent un corps de requête au-delà de 4,5 Mo. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/** Taille maximale d'un XML extrait d'un PDF (décompressé). */
export const MAX_XML_BYTES = 5 * 1024 * 1024

export type FileKind = "pdf" | "xml"

/** Type réel du fichier, d'après ses premiers octets ; null s'il n'est ni PDF ni XML. */
export function sniffKind(bytes: Uint8Array): FileKind | null {
  // PDF : « %PDF- » dans les 1 024 premiers octets (tolérance de la norme ISO 32000)
  const head = binaryString(bytes.subarray(0, 1024))
  if (head.includes("%PDF-")) return "pdf"
  // UTF-16 avec BOM
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return "xml"
  // XML : premier caractère significatif « < » (après BOM UTF-8 et espaces)
  let i = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++
  return bytes[i] === 0x3c ? "xml" : null
}

/** Octets → chaîne d'un caractère par octet (ISO-8859-1 exact), pour chercher des mots-clés PDF. */
export function binaryString(bytes: Uint8Array): string {
  let out = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return out
}

/**
 * Texte d'un fichier XML : BOM d'abord, puis encodage déclaré dans le
 * prologue (UTF-8 par défaut, comme le veulent CII et UBL).
 */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2))
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3))
  const prolog = binaryString(bytes.subarray(0, 200))
  const declared = /^\s*<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(prolog)?.[1]?.toLowerCase()
  if (declared && /^(iso-8859-1|iso8859-1|latin1|latin-1|windows-1252|cp1252|iso-8859-15)$/.test(declared)) {
    return new TextDecoder("windows-1252").decode(bytes)
  }
  return new TextDecoder("utf-8").decode(bytes)
}

export class InflateError extends Error {
  constructor(public readonly code: "too_large" | "corrupt", message: string) {
    super(message)
    this.name = "InflateError"
  }
}

/**
 * Décompresse un flux zlib (filtre /FlateDecode d'un PDF) en s'arrêtant dès que
 * la sortie dépasse `max` octets : une « bombe de décompression » de quelques
 * kilo-octets ne peut pas remplir la mémoire du serveur.
 */
export async function inflateLimited(data: Uint8Array, max: number): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate")
  const writer = ds.writable.getWriter()
  const reader = ds.readable.getReader()
  const writing = writer.write(data as unknown as BufferSource).then(() => writer.close()).catch(() => undefined)

  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > max) {
        await reader.cancel().catch(() => undefined)
        throw new InflateError("too_large", "Fichier embarqué trop volumineux une fois décompressé.")
      }
      chunks.push(value)
    }
  } catch (e) {
    if (e instanceof InflateError) throw e
    // Flux tronqué ou somme de contrôle absente : on garde ce qui a pu être lu
    if (total === 0) throw new InflateError("corrupt", "Flux compressé illisible.")
  }
  await writing

  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}
