/**
 * Métadonnées écrites dans les images du blog générées par Qonforme (couvertures
 * dessinées par le code, photos générées par Gemini) : titre, description,
 * mots-clés, auteur, copyright et origine de l'image, en XMP (WebP) et en EXIF
 * (texte ASCII seulement : le texte accentué n'y survit pas).
 *
 * - Tout ce que l'image portait est retiré avant (position GPS, appareil,
 *   logiciel) : ne reste que ce qui est écrit ici. Jamais de faux appareil
 *   photo, jamais de lieu.
 * - Google lit, dans une image, l'auteur, le crédit et le copyright (IPTC / XMP :
 *   dc:creator, photoshop:Credit, dc:rights) pour les afficher dans Google Images.
 *   Les mots-clés intégrés n'ont aucun usage documenté pour le classement : ils
 *   servent aux outils qui lisent les fichiers (photothèques, CMS). Les leviers
 *   qui comptent sont le nom du fichier, le texte alternatif, la légende et le
 *   texte autour de l'image.
 * - L'origine suit le standard IPTC « DigitalSourceType » : « trainedAlgorithmicMedia »
 *   pour une image générée par IA, « digitalArt » pour une couverture dessinée
 *   par le code.
 * - Les images importées par l'admin ne reçoivent aucune de ces mentions
 *   (auteur et copyright inconnus) : elles sont seulement nettoyées.
 *
 * Module pur : serveur et tests.
 */

export type ImageSource = "ai" | "graphic"

export interface ImageMetadata {
  title?: string
  description?: string
  keywords?: (string | null | undefined)[]
  /** Auteur (dc:creator) : « Qonforme ». */
  creator?: string
  /** Crédit (photoshop:Credit). */
  credit?: string
  /** Origine : image générée par IA ou graphisme créé par le code. */
  source?: ImageSource
}

const SOURCE_URI: Record<ImageSource, string> = {
  ai: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
  graphic: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalArt",
}

/** Texte sans caractère de contrôle ni chevron ouvrant de balise, espaces réduits, borné. */
export function metaText(value: string | null | undefined, max: number): string {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim()
}

const xmlEscape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")

/** Texte ASCII (accents retirés, le reste devient « ? ») pour les champs EXIF. */
export function asciiOf(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Droit d'auteur affiché : « © 2026 Qonforme ». */
export function rightsOf(year: number, creator = "Qonforme"): string {
  return `© ${year} ${creator}`
}

/** Mots-clés nettoyés : sans doublon (accents et casse), 20 au plus, 80 caractères chacun. */
export function cleanKeywords(list: (string | null | undefined)[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list ?? []) {
    const k = metaText(raw, 80)
    const key = asciiOf(k).toLowerCase()
    if (!k || seen.has(key)) continue
    seen.add(key)
    out.push(k)
    if (out.length >= 20) break
  }
  return out
}

/** Paquet XMP : dc:title, dc:description, dc:subject, dc:creator, dc:rights, photoshop:Credit, origine IPTC. */
export function xmpOf(meta: ImageMetadata, year: number): string {
  const title = metaText(meta.title, 200)
  const description = metaText(meta.description, 500)
  const keywords = cleanKeywords(meta.keywords)
  const creator = metaText(meta.creator, 80)
  const credit = metaText(meta.credit ?? meta.creator, 80)
  const alt = (tag: string, text: string) => `<${tag}><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(text)}</rdf:li></rdf:Alt></${tag}>`
  const body: string[] = []
  if (title) body.push(alt("dc:title", title))
  if (description) body.push(alt("dc:description", description))
  if (keywords.length > 0) body.push(`<dc:subject><rdf:Bag>${keywords.map((k) => `<rdf:li>${xmlEscape(k)}</rdf:li>`).join("")}</rdf:Bag></dc:subject>`)
  if (creator) {
    body.push(`<dc:creator><rdf:Seq><rdf:li>${xmlEscape(creator)}</rdf:li></rdf:Seq></dc:creator>`)
    body.push(alt("dc:rights", rightsOf(year, creator)))
    body.push(`<xmp:CreatorTool>${xmlEscape(creator)}</xmp:CreatorTool>`)
  }
  if (credit) body.push(`<photoshop:Credit>${xmlEscape(credit)}</photoshop:Credit>`)
  if (meta.source) body.push(`<Iptc4xmpExt:DigitalSourceType>${SOURCE_URI[meta.source]}</Iptc4xmpExt:DigitalSourceType>`)
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">',
    ...body,
    "</rdf:Description>",
    "</rdf:RDF>",
    "</x:xmpmeta>",
    '<?xpacket end="w"?>',
  ].join("")
}

/** Champs EXIF (ASCII) : description, auteur, copyright. */
export function exifOf(meta: ImageMetadata, year: number): { IFD0: Record<string, string> } {
  const IFD0: Record<string, string> = {}
  const description = asciiOf(metaText(meta.description ?? meta.title, 200))
  if (description) IFD0.ImageDescription = description
  const creator = asciiOf(metaText(meta.creator, 80))
  if (creator) {
    IFD0.Artist = creator
    IFD0.Copyright = `Copyright ${year} ${creator}`
  }
  return { IFD0 }
}
