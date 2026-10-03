/**
 * Générateur de QR code minimal (norme ISO/IEC 18004), sans dépendance :
 * mode octet seulement, niveau de correction M (celui qu'impose le format EPC
 * du virement SEPA, voir lib/payment-link/epc.ts), versions 1 à 40.
 *
 * Écrit pour ce seul usage : un texte de quelques centaines d'octets rendu en
 * SVG sur la page de règlement. Vérifié dans __tests__/payment-link-qr.test.ts
 * (motifs fixes, informations de format, capacité) et, au développement, en
 * comparant les matrices à celles d'une bibliothèque de référence et en les
 * relisant avec un décodeur.
 */

/* ------------------------------------------------------------------ */
/* Tables de la norme pour le niveau M (ISO/IEC 18004, tableau 9)      */
/* ------------------------------------------------------------------ */

/** Mots de code de correction par bloc, versions 1 à 40 (index 0 inutilisé). */
const ECC_PER_BLOCK_M = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
]
/** Nombre de blocs de correction, versions 1 à 40. */
const BLOCKS_M = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
]
/** Bits d'indicateur de niveau dans l'information de format (M = 00). */
const FORMAT_ECL_M = 0

export interface QrMatrix {
  /** Côté en modules (21 pour la version 1, +4 par version). */
  size: number
  version: number
  mask: number
  /** modules[y][x] : vrai = module foncé. */
  modules: boolean[][]
}

/* ------------------------------------------------------------------ */
/* Capacité                                                            */
/* ------------------------------------------------------------------ */

/** Modules disponibles pour les données et la correction (hors motifs fixes). */
function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

/** Mots de code de données (8 bits) à la version donnée, niveau M. */
export function dataCodewords(ver: number): number {
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK_M[ver] * BLOCKS_M[ver]
}

/** Bits du compteur de caractères en mode octet. */
const countBits = (ver: number) => (ver <= 9 ? 8 : 16)

/** Plus petite version qui contient `byteLength` octets, ou null. */
export function versionFor(byteLength: number, maxVersion = 40): number | null {
  for (let ver = 1; ver <= maxVersion; ver++) {
    if (4 + countBits(ver) + byteLength * 8 <= dataCodewords(ver) * 8) return ver
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Reed-Solomon sur GF(256), polynôme 0x11D                            */
/* ------------------------------------------------------------------ */

function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

/** Diviseur de degré `degree` : produit des (x − αⁱ), coefficients du plus fort au plus faible, sans le terme dominant. */
function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor) })
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Codage des données                                                  */
/* ------------------------------------------------------------------ */

/** Mots de code de données : mode, longueur, octets, terminateur, remplissage. */
function dataStream(bytes: Uint8Array, ver: number): number[] {
  const capacity = dataCodewords(ver)
  const bits: number[] = []
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)                    // mode octet
  push(bytes.length, countBits(ver)) // nombre d'octets
  bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, capacity * 8 - bits.length)) // terminateur
  push(0, (8 - (bits.length % 8)) % 8)            // alignement sur l'octet

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2))
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad)
  return data
}

/** Données + correction, découpées en blocs puis entrelacées. */
function interleave(data: number[], ver: number): number[] {
  const numBlocks = BLOCKS_M[ver]
  const eccLen = ECC_PER_BLOCK_M[ver]
  const rawCodewords = Math.floor(rawDataModules(ver) / 8)
  const numShort = numBlocks - (rawCodewords % numBlocks)
  const shortLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(eccLen)

  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dataLen = shortLen - eccLen + (i < numShort ? 0 : 1)
    const chunk = data.slice(k, k + dataLen)
    k += dataLen
    const ecc = rsRemainder(chunk, divisor)
    if (i < numShort) chunk.push(-1) // place vide : les blocs courts ont un octet de moins
    blocks.push([...chunk, ...ecc])
  }

  const result: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i])
    })
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Matrice                                                             */
/* ------------------------------------------------------------------ */

function alignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return []
  const numAlign = Math.floor(ver / 7) + 2
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2
  const result = [6]
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos)
  return result
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

class Grid {
  readonly size: number
  readonly modules: boolean[][]
  readonly fixed: boolean[][]
  constructor(size: number) {
    this.size = size
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
    this.fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  }
  set(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark
    this.fixed[y][x] = true
  }
}

function drawFunctionPatterns(g: Grid, ver: number) {
  const { size } = g
  // Motifs de synchronisation
  for (let i = 0; i < size; i++) {
    g.set(6, i, i % 2 === 0)
    g.set(i, 6, i % 2 === 0)
  }
  // Repères de position et leurs séparateurs
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || x >= size || y < 0 || y >= size) continue
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        g.set(x, y, dist !== 2 && dist !== 4)
      }
    }
  }
  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)
  // Motifs d'alignement (sauf sur les trois repères)
  const align = alignmentPositions(ver, size)
  const last = align.length - 1
  align.forEach((ay, i) => {
    align.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) g.set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    })
  })
  // Zones réservées aux informations de format (remplies après le choix du masque)
  drawFormat(g, 0)
  drawVersion(g, ver)
}

const bit = (value: number, i: number) => ((value >>> i) & 1) !== 0

/** Information de format : niveau M et masque, code BCH(15,5), masque 0x5412. */
export function formatBits(mask: number): number {
  const data = (FORMAT_ECL_M << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

function drawFormat(g: Grid, mask: number) {
  const bits = formatBits(mask)
  const { size } = g
  for (let i = 0; i <= 5; i++) g.set(8, i, bit(bits, i))
  g.set(8, 7, bit(bits, 6))
  g.set(8, 8, bit(bits, 7))
  g.set(7, 8, bit(bits, 8))
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, bit(bits, i))
  for (let i = 0; i < 8; i++) g.set(size - 1 - i, 8, bit(bits, i))
  for (let i = 8; i < 15; i++) g.set(8, size - 15 + i, bit(bits, i))
  g.set(8, size - 8, true) // module foncé obligatoire
}

/** Information de version (versions 7 et plus) : code BCH(18,6). */
function drawVersion(g: Grid, ver: number) {
  if (ver < 7) return
  let rem = ver
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  const bits = (ver << 12) | rem
  for (let i = 0; i < 18; i++) {
    const a = g.size - 11 + (i % 3)
    const b = Math.floor(i / 3)
    g.set(a, b, bit(bits, i))
    g.set(b, a, bit(bits, i))
  }
}

/** Placement en zigzag, par colonnes de deux, de bas en haut puis de haut en bas. */
function drawCodewords(g: Grid, data: number[]) {
  const { size } = g
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!g.fixed[y][x] && i < data.length * 8) {
          g.modules[y][x] = bit(data[i >>> 3], 7 - (i & 7))
          i++
        }
      }
    }
  }
}

function applyMask(g: Grid, mask: number) {
  const fn = MASKS[mask]
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.fixed[y][x] && fn(x, y)) g.modules[y][x] = !g.modules[y][x]
    }
  }
}

/** Pénalité d'un masque (ISO/IEC 18004, 7.8.3) : plus elle est basse, plus le code se lit bien. */
export function penalty(modules: boolean[][]): number {
  const size = modules.length
  let score = 0
  const lines: boolean[][] = []
  for (let y = 0; y < size; y++) lines.push(modules[y])
  for (let x = 0; x < size; x++) lines.push(modules.map((row) => row[x]))

  const finderA = [true, false, true, true, true, false, true, false, false, false, false]
  const finderB = [false, false, false, false, true, false, true, true, true, false, true]
  for (const line of lines) {
    // Règle 1 : suites de 5 modules ou plus de même couleur
    let run = 1
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++
      else {
        if (run >= 5) score += 3 + (run - 5)
        run = 1
      }
    }
    // Règle 3 : motifs qui ressemblent à un repère de position
    for (let i = 0; i + 11 <= size; i++) {
      if (finderA.every((v, k) => line[i + k] === v) || finderB.every((v, k) => line[i + k] === v)) score += 40
    }
  }
  // Règle 2 : carrés 2 × 2 de même couleur
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x]
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3
    }
  }
  // Règle 4 : équilibre entre modules foncés et clairs
  const dark = modules.reduce((s, row) => s + row.filter(Boolean).length, 0)
  const total = size * size
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
  score += Math.max(0, k) * 10
  return score
}

/**
 * Matrice du QR code d'un texte (UTF-8, mode octet, niveau M), ou null s'il
 * dépasse `maxVersion`. `forceMask` sert aux tests ; sinon le masque de plus
 * faible pénalité est retenu.
 */
export function encodeQr(text: string, opts: { maxVersion?: number; forceMask?: number } = {}): QrMatrix | null {
  const bytes = new TextEncoder().encode(text)
  const ver = versionFor(bytes.length, opts.maxVersion ?? 40)
  if (ver === null) return null
  const size = ver * 4 + 17
  const data = interleave(dataStream(bytes, ver), ver)

  const build = (mask: number): Grid => {
    const g = new Grid(size)
    drawFunctionPatterns(g, ver)
    drawCodewords(g, data)
    applyMask(g, mask)
    drawFormat(g, mask)
    return g
  }

  let best = opts.forceMask ?? 0
  if (opts.forceMask === undefined) {
    let bestScore = Infinity
    for (let mask = 0; mask < 8; mask++) {
      const s = penalty(build(mask).modules)
      if (s < bestScore) { bestScore = s; best = mask }
    }
  }
  return { size, version: ver, mask: best, modules: build(best).modules }
}

/**
 * Tracé SVG des modules foncés (une suite de rectangles par ligne), décalé de
 * `quiet` modules pour la marge blanche (4 au minimum selon la norme).
 */
export function qrSvgPath(qr: QrMatrix, quiet = 4): string {
  const parts: string[] = []
  qr.modules.forEach((row, y) => {
    for (let x = 0; x < qr.size; ) {
      if (!row[x]) { x++; continue }
      let run = 1
      while (x + run < qr.size && row[x + run]) run++
      parts.push(`M${x + quiet} ${y + quiet}h${run}v1h-${run}z`)
      x += run
    }
  })
  return parts.join("")
}
