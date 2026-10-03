/**
 * Archive ZIP minimale, sans dépendance : fichiers compressés (deflate) ou
 * stockés tels quels quand la compression ne gagne rien (cas des PDF, déjà
 * compressés). Noms en UTF-8 (bit 11 des drapeaux).
 *
 * Format : APPNOTE.TXT de PKWARE, version 6.3.10, sections 4.3.7 (en-tête
 * local), 4.3.12 (répertoire central) et 4.3.16 (fin du répertoire central) :
 * https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 * Pas de ZIP64 : moins de 65 535 fichiers et de 4 Go, largement au-dessus de
 * ce que produit l'espace comptable (ZIP_MAX_DOCUMENTS).
 *
 * Module serveur (node:zlib) ; testé dans __tests__/accountant-exports.test.ts.
 */
import { deflateRawSync } from "node:zlib"

export interface ZipEntry {
  name: string
  data: Uint8Array
  /** Date du fichier (défaut : maintenant). */
  modified?: Date
}

/* CRC-32 (polynôme 0xEDB88320), table calculée une fois */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Date et heure au format MS-DOS, en heure de Paris (le ZIP ne connaît pas les fuseaux). */
function dosDateTime(d: Date): { date: number; time: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  )
  const year = Math.max(1980, Number(parts.year))
  return {
    date: ((year - 1980) << 9) | (Number(parts.month) << 5) | Number(parts.day),
    time: (Number(parts.hour) << 11) | (Number(parts.minute) << 5) | Math.floor(Number(parts.second) / 2),
  }
}

/** Nom de fichier sûr dans une archive : ni dossier, ni caractère interdit sous Windows. */
export function safeZipName(name: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/^\.+/, "")
    .trim()
  return (cleaned || "document").slice(0, 120)
}

/** Noms uniques : « F-1.pdf », « F-1 (2).pdf »… */
function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((raw) => {
    const name = safeZipName(raw)
    const key = name.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    if (n === 1) return name
    const dot = name.lastIndexOf(".")
    return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
  })
}

/** Construit l'archive. */
export function createZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length > 0xffff) throw new Error("Trop de fichiers pour une archive sans ZIP64")
  const names = uniqueNames(entries.map((e) => e.name))
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  entries.forEach((entry, i) => {
    const name = encoder.encode(names[i])
    const crc = crc32(entry.data)
    const deflated = deflateRawSync(entry.data)
    const useDeflate = deflated.length < entry.data.length
    const body = useDeflate ? new Uint8Array(deflated.buffer, deflated.byteOffset, deflated.length) : entry.data
    const method = useDeflate ? 8 : 0
    const { date, time } = dosDateTime(entry.modified ?? new Date())
    const FLAGS = 0x0800 // noms en UTF-8

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)          // version nécessaire : 2.0
    lv.setUint16(6, FLAGS, true)
    lv.setUint16(8, method, true)
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, body.length, true)
    lv.setUint32(22, entry.data.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)          // pas de champ supplémentaire
    local.set(name, 30)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)          // créé par : 2.0 (MS-DOS)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, FLAGS, true)
    cv.setUint16(10, method, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, body.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, name.length, true)
    // 30 : champ supplémentaire, 32 : commentaire, 34 : disque, 36 : attributs internes, 38 : externes → 0
    cv.setUint32(42, offset, true)
    central.set(name, 46)

    locals.push(local, body)
    centrals.push(central)
    offset += local.length + body.length
  })

  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + centralSize + end.length)
  let pos = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}
