/**
 * Différence mot à mot entre un passage et sa réécriture : « Avant » montre
 * les mots retirés, « Après » les mots ajoutés (fenêtre d'intégration d'un
 * mot-clé). Plus longue sous-suite commune sur les mots, en texte brut.
 *
 * Module pur : __tests__/blog-editor-word-diff.test.ts.
 */
import { markdownPlainText } from "@/lib/seo/articles/onpage"

export interface DiffPart {
  text: string
  /** Mot(s) retiré(s) côté « avant », ajouté(s) côté « après ». */
  changed: boolean
}

export interface WordDiff {
  before: DiffPart[]
  after: DiffPart[]
}

/** Au-delà, la comparaison ne se fait pas (passages de 1 200 caractères au plus en pratique). */
const MAX_CELLS = 250_000

const words = (text: string) => markdownPlainText(text).split(/\s+/).filter(Boolean)

function merge(tokens: { word: string; changed: boolean }[]): DiffPart[] {
  const parts: DiffPart[] = []
  for (const t of tokens) {
    const last = parts[parts.length - 1]
    if (last && last.changed === t.changed) last.text += ` ${t.word}`
    else parts.push({ text: t.word, changed: t.changed })
  }
  return parts
}

export function diffWords(before: string, after: string): WordDiff {
  const a = words(before)
  const b = words(after)
  if (a.length * b.length > MAX_CELLS) {
    return { before: [{ text: a.join(" "), changed: false }], after: [{ text: b.join(" "), changed: false }] }
  }
  // table[i][j] : longueur de la sous-suite commune de a[i..] et b[j..]
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const left: { word: string; changed: boolean }[] = []
  const right: { word: string; changed: boolean }[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      left.push({ word: a[i], changed: false })
      right.push({ word: b[j], changed: false })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      left.push({ word: a[i++], changed: true })
    } else {
      right.push({ word: b[j++], changed: true })
    }
  }
  while (i < a.length) left.push({ word: a[i++], changed: true })
  while (j < b.length) right.push({ word: b[j++], changed: true })
  return { before: merge(left), after: merge(right) }
}
