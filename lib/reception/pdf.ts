/**
 * Extraction du XML embarqué dans un PDF Factur-X.
 *
 * Un Factur-X est un PDF/A-3 qui joint un fichier « factur-x.xml » (CII) comme
 * fichier associé (spécification Factur-X, FNFE-MPE / FeRD ; ISO 19005-3).
 * Le fichier joint est un flux /Type /EmbeddedFile, toujours un objet de
 * premier niveau (un flux ne peut pas loger dans un flux d'objets, ISO 32000-1
 * § 7.5.7).
 *
 * Plutôt que d'ouvrir tout le document avec une bibliothèque PDF (qui
 * décompresserait sans limite chaque flux, y compris des bombes de
 * décompression), ce module cherche directement les flux de fichiers
 * embarqués, les décompresse avec une borne (inflateLimited) et rend les XML
 * trouvés, du plus récent (fin de fichier, mises à jour incrémentales) au plus
 * ancien. Le choix de la facture parmi eux est fait par l'appelant.
 */
import { binaryString, inflateLimited, InflateError, MAX_XML_BYTES } from "@/lib/reception/bytes"

export interface EmbeddedFile {
  /** Contenu décompressé. */
  bytes: Uint8Array
  /** Sous-type déclaré (« text/xml »), s'il est présent. */
  subtype: string | null
}

export interface PdfScan {
  /** Le document est chiffré : ses fichiers joints ne sont pas lisibles. */
  encrypted: boolean
  files: EmbeddedFile[]
  /** Flux ignorés (filtre non pris en charge, trop volumineux…). */
  skipped: number
}

const MAX_CANDIDATES = 20
/** Total décompressé pour l'ensemble des pièces jointes d'un même PDF. */
const MAX_TOTAL_BYTES = 2 * MAX_XML_BYTES
const MAX_DICT_CHARS = 16 * 1024

/** Fin du dictionnaire « << … >> » qui commence à `start`, en sautant chaînes et chaînes hexadécimales. */
function dictEnd(s: string, start: number): number {
  let depth = 0
  let i = start
  const limit = Math.min(s.length, start + MAX_DICT_CHARS)
  while (i < limit) {
    const c = s[i]
    if (c === "<" && s[i + 1] === "<") { depth++; i += 2; continue }
    if (c === ">" && s[i + 1] === ">") { depth--; i += 2; if (depth === 0) return i; continue }
    if (c === "(") {
      // Chaîne littérale : parenthèses imbriquées, échappements « \ »
      let nest = 1
      i++
      while (i < limit && nest > 0) {
        if (s[i] === "\\") { i += 2; continue }
        if (s[i] === "(") nest++
        else if (s[i] === ")") nest--
        i++
      }
      continue
    }
    if (c === "<") {
      const close = s.indexOf(">", i + 1)
      if (close === -1) return -1
      i = close + 1
      continue
    }
    i++
  }
  return -1
}

/** Valeur d'un nom dans un dictionnaire (« /Subtype /text#2Fxml » → « text/xml »). */
function nameValue(dict: string, key: string): string | null {
  const m = new RegExp(`/${key}\\s*/([^\\s/<>\\[\\]()]+)`).exec(dict)
  return m ? m[1].replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) : null
}

/** Filtres d'un flux (« /Filter /FlateDecode » ou « /Filter [/FlateDecode] »). */
function filtersOf(dict: string): string[] | null {
  const single = /\/Filter\s*\/([A-Za-z0-9]+)/.exec(dict)
  if (single) return [single[1]]
  const arr = /\/Filter\s*\[([^\]]*)\]/.exec(dict)
  if (arr) return Array.from(arr[1].matchAll(/\/([A-Za-z0-9]+)/g)).map((m) => m[1])
  return []
}

/** Longueur déclarée du flux, directe ou par référence indirecte « n g R » résolue dans le fichier. */
function streamLength(dict: string, s: string): number | null {
  const indirect = /\/Length\s+(\d+)\s+(\d+)\s+R/.exec(dict)
  if (indirect) {
    const m = new RegExp(`(?:^|[^0-9])${indirect[1]}\\s+${indirect[2]}\\s+obj\\s*(\\d+)\\s*endobj`).exec(s)
    return m ? Number(m[1]) : null
  }
  const direct = /\/Length\s+(\d+)/.exec(dict)
  return direct ? Number(direct[1]) : null
}

/**
 * Cherche les fichiers embarqués d'un PDF.
 * Ne lève pas d'erreur sur un PDF abîmé : il rend simplement moins de fichiers.
 */
export async function scanPdfAttachments(bytes: Uint8Array): Promise<PdfScan> {
  const s = binaryString(bytes)
  // Dictionnaire de chiffrement référencé par la remorque (ou le flux de références croisées)
  const encrypted = /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(s)

  const files: EmbeddedFile[] = []
  let skipped = 0

  // Repères « /Type /EmbeddedFile » (ou sous-type XML) : seuls les derniers comptent,
  // ce qui borne le travail même sur un fichier fabriqué pour en contenir des milliers.
  const marks: number[] = []
  const keyRe = /\/Type\s*\/EmbeddedFile(?![A-Za-z])|\/Subtype\s*\/(?:text|application)#2Fxml/gi
  let k: RegExpExecArray | null
  while ((k = keyRe.exec(s))) {
    marks.push(k.index)
    if (marks.length > MAX_CANDIDATES * 2) marks.shift()
  }

  // Pour chaque repère, le dictionnaire de l'objet qui le contient, puis le flux qui suit
  const candidates: { dict: string; dataStart: number }[] = []
  const seen = new Set<number>()
  for (const pos of marks.reverse()) {
    const windowStart = Math.max(0, pos - 8192)
    const before = s.slice(windowStart, pos)
    let objMatch: RegExpExecArray | null = null
    const objRe = /\d+\s+\d+\s+obj\s*<</g
    let o: RegExpExecArray | null
    while ((o = objRe.exec(before))) objMatch = o
    if (!objMatch) continue
    const dictStart = windowStart + objMatch.index + objMatch[0].length - 2
    if (seen.has(dictStart)) continue
    seen.add(dictStart)
    const end = dictEnd(s, dictStart)
    if (end === -1 || end <= pos) continue
    const after = /^\s*stream(\r\n|\n|\r)/.exec(s.slice(end, end + 32))
    if (!after) continue
    candidates.push({ dict: s.slice(dictStart, end), dataStart: end + after[0].length })
    if (candidates.length >= MAX_CANDIDATES) break
  }

  // Les plus récents d'abord (mises à jour incrémentales en fin de fichier)
  let budget = MAX_TOTAL_BYTES
  for (const c of candidates) {
    if (budget <= 0) { skipped++; continue }
    const declared = streamLength(c.dict, s)
    let dataEnd = -1
    if (declared !== null && c.dataStart + declared <= bytes.length) {
      const tail = s.slice(c.dataStart + declared, c.dataStart + declared + 16)
      if (/^\s*endstream/.test(tail)) dataEnd = c.dataStart + declared
    }
    if (dataEnd === -1) {
      const es = s.indexOf("endstream", c.dataStart)
      if (es === -1) { skipped++; continue }
      dataEnd = es
      // Fin de ligne qui précède « endstream »
      if (s[dataEnd - 1] === "\n") dataEnd--
      if (s[dataEnd - 1] === "\r") dataEnd--
    }
    const raw = bytes.subarray(c.dataStart, dataEnd)
    const filters = filtersOf(c.dict) ?? []
    const predictor = /\/Predictor\s+(\d+)/.exec(c.dict)
    if (predictor && Number(predictor[1]) > 1) { skipped++; continue }

    let data: Uint8Array
    try {
      if (filters.length === 0) {
        if (raw.byteLength > Math.min(MAX_XML_BYTES, budget)) { skipped++; continue }
        data = raw
      } else if (filters.length === 1 && (filters[0] === "FlateDecode" || filters[0] === "Fl")) {
        data = await inflateLimited(raw, Math.min(MAX_XML_BYTES, budget))
      } else {
        skipped++
        continue
      }
    } catch (e) {
      if (e instanceof InflateError) { skipped++; continue }
      throw e
    }
    budget -= data.byteLength
    files.push({ bytes: data, subtype: nameValue(c.dict, "Subtype") })
  }

  return { encrypted, files, skipped }
}
