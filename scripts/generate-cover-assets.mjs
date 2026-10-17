/**
 * Génère lib/blog-images/cover/assets.generated.ts : polices, logo et largeurs
 * de caractères de la couverture des articles (lib/blog-images/cover/).
 *
 * Les polices et le logo sont embarqués en base64 : aucune lecture de fichier
 * au moment de la requête (rien à déclarer au traçage des fichiers de Vercel).
 * Les largeurs servent à couper le titre en lignes avant le rendu (le moteur de
 * rendu ne mesure pas le texte pour nous).
 *
 * À relancer si une police ou le logo change :
 *   npm i --no-save opentype.js && node scripts/generate-cover-assets.mjs
 *
 * Polices (licence SIL OFL 1.1, textes dans lib/blog-images/cover/fonts/) :
 * Bricolage Grotesque 700 et Instrument Serif italique, sous-ensemble latin
 * de @fontsource (le même dessin que le site).
 */
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const opentype = require("opentype.js")

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "blog-images", "cover")
const read = (rel) => readFileSync(join(root, rel))

/** Caractères mesurés : ASCII, Latin-1, œ/Œ, ponctuation courante, espaces fines, euro. */
function charset() {
  const chars = []
  for (let c = 0x20; c <= 0x7e; c++) chars.push(c)
  for (let c = 0xa0; c <= 0xff; c++) chars.push(c)
  chars.push(0x152, 0x153, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x20ac, 0x202f, 0x2009)
  return chars
}

function metrics(buffer) {
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  const widths = {}
  let total = 0
  let count = 0
  for (const code of charset()) {
    const glyph = font.charToGlyph(String.fromCodePoint(code))
    if (!glyph || glyph.index === 0) continue
    widths[String.fromCodePoint(code)] = Math.round(glyph.advanceWidth)
    if (code >= 0x61 && code <= 0x7a) {
      total += glyph.advanceWidth
      count++
    }
  }
  return { upm: font.unitsPerEm, fallback: Math.round(total / count), widths }
}

const sans = read("fonts/BricolageGrotesque-700.woff")
const serif = read("fonts/InstrumentSerif-Italic.woff")
const logo = read("logo-long-bleu.png")

const out = `/**
 * Généré par scripts/generate-cover-assets.mjs : ne pas modifier à la main.
 * Polices SIL OFL 1.1 (Bricolage Grotesque 700, Instrument Serif italique),
 * logo Qonforme et largeurs de caractères (unités de la police).
 */

export const SANS_FONT_BASE64 = "${sans.toString("base64")}"
export const SERIF_FONT_BASE64 = "${serif.toString("base64")}"
export const LOGO_PNG_BASE64 = "${logo.toString("base64")}"

export interface FontMetrics {
  upm: number
  /** Largeur d'un caractère inconnu (moyenne des minuscules). */
  fallback: number
  widths: Record<string, number>
}

export const SANS_METRICS: FontMetrics = ${JSON.stringify(metrics(sans))}
export const SERIF_METRICS: FontMetrics = ${JSON.stringify(metrics(serif))}
`
writeFileSync(join(root, "assets.generated.ts"), out)
console.log("assets.generated.ts :", Math.round(out.length / 1024), "Ko")
