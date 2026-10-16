/**
 * Reconnaissance d'une image par ses premiers octets (« magic numbers »), et
 * lecture de ses dimensions, sans dépendance.
 *
 * Le compartiment des images du blog est public : seuls JPEG, PNG et WebP y
 * entrent, reconnus par leur contenu et jamais par l'extension ni par le type
 * annoncé par le navigateur (un .jpg qui contient du SVG ou du HTML est
 * refusé). Les dimensions servent au fragment « #w=…&h=… » de l'adresse
 * (lib/blog-images/policy.ts) : la page réserve la place de l'image.
 *
 * Formats lus :
 * - PNG : signature de 8 octets puis bloc IHDR (largeur, hauteur sur 4 octets) ;
 * - JPEG : FF D8 FF, puis parcours des segments jusqu'au premier SOFn
 *   (C0 à CF sauf C4 DHT, C8 JPG et CC DAC), qui porte hauteur et largeur ;
 * - WebP : conteneur RIFF « WEBP » et premier bloc VP8 (avec perte), VP8L
 *   (sans perte) ou VP8X (étendu, taille du canevas).
 *
 * Module pur : serveur, navigateur et tests.
 */
import type { AcceptedImageType } from "@/lib/blog-images/policy"

export interface SniffedImage {
  mimeType: AcceptedImageType
  width: number
  height: number
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((b, i) => bytes[offset + i] === b)
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return ""
  let s = ""
  for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i])
  return s
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1]
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)
// >>> 0 : entier non signé (un octet de poids fort à 1 donnerait un nombre négatif)
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0

function sized(mimeType: AcceptedImageType, width: number, height: number): SniffedImage | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null
  return { mimeType, width, height }
}

function sniffPng(bytes: Uint8Array): SniffedImage | null {
  // Signature (8) + longueur du bloc (4) + « IHDR » (4) + largeur (4) + hauteur (4)
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== "IHDR") return null
  return sized("image/png", u32be(bytes, 16), u32be(bytes, 20))
}

/** Marqueurs SOFn qui portent les dimensions de l'image (C4, C8 et CC ne sont pas des SOF). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

function sniffJpeg(bytes: Uint8Array): SniffedImage | null {
  let offset = 2
  while (offset < bytes.length) {
    // Chaque segment commence par FF ; des FF de remplissage peuvent précéder le marqueur
    if (bytes[offset] !== 0xff) return null
    while (offset < bytes.length && bytes[offset] === 0xff) offset++
    if (offset >= bytes.length) return null
    const marker = bytes[offset]
    offset++
    // Marqueurs sans longueur : TEM, RST0 à RST7, SOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue
    // Fin d'image, ou début des données compressées, avant tout SOF : pas une image lisible
    if (marker === 0xd9 || marker === 0xda) return null
    if (offset + 2 > bytes.length) return null
    const length = u16be(bytes, offset)
    if (length < 2) return null
    if (isStartOfFrame(marker)) {
      // Longueur (2), précision (1), hauteur (2), largeur (2)
      if (offset + 7 > bytes.length) return null
      return sized("image/jpeg", u16be(bytes, offset + 5), u16be(bytes, offset + 3))
    }
    offset += length
  }
  return null
}

function sniffWebp(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length < 30) return null
  const chunk = ascii(bytes, 12, 4)
  const data = 20
  if (chunk === "VP8 ") {
    // Image clé : 3 octets d'en-tête de trame, code de début 9D 01 2A, puis largeur et hauteur sur 14 bits
    if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) return null
    return sized("image/webp", u16le(bytes, data + 6) & 0x3fff, u16le(bytes, data + 8) & 0x3fff)
  }
  if (chunk === "VP8L") {
    // Signature 0x2F, puis largeur − 1 et hauteur − 1 sur 14 bits chacune
    if (bytes[data] !== 0x2f) return null
    const b1 = bytes[data + 1]
    const b2 = bytes[data + 2]
    const b3 = bytes[data + 3]
    const b4 = bytes[data + 4]
    const width = 1 + (((b2 & 0x3f) << 8) | b1)
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
    return sized("image/webp", width, height)
  }
  if (chunk === "VP8X") {
    // Drapeaux (1) + réservé (3), puis largeur − 1 et hauteur − 1 du canevas sur 24 bits
    return sized("image/webp", 1 + u24le(bytes, data + 4), 1 + u24le(bytes, data + 7))
  }
  return null
}

/**
 * Type réel et dimensions d'une image JPEG, PNG ou WebP ; null pour tout le
 * reste (GIF, SVG, HEIC, PDF, texte…) ou pour un fichier tronqué.
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (!bytes || bytes.length < 12) return null
  if (startsWith(bytes, PNG_SIGNATURE)) return sniffPng(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return sniffJpeg(bytes)
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return sniffWebp(bytes)
  return null
}
