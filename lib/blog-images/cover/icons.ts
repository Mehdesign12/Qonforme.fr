/**
 * Icônes de la couverture d'un article : huit emplacements (lib/blog-images/cover/layout.ts),
 * deux en bleu (le sujet, puis un outil ou un second sujet), six en bleu pâle.
 *
 * Le choix suit le sujet du titre et du mot-clé :
 * - un métier reconnu (lib/blog-images/trades.ts) : son icône en grand, des icônes
 *   de son univers, et des papiers du devis pour garder le lien avec Qonforme ;
 * - un sujet de papiers (devis, facture, TVA, relance, paiement, signature,
 *   mentions, règles) : l'icône du sujet, plus un casque et une maison pour
 *   rappeler le bâtiment ;
 * - sinon : le chantier et ses outils.
 *
 * Le hasard est fixé par le titre (`seed`) : la même couverture à chaque rendu,
 * mais deux articles du même sujet ne se ressemblent pas trait pour trait.
 *
 * Module pur : serveur et tests.
 */
import { detectTrade, foldText, type TradeId } from "@/lib/blog-images/trades"
import type { CoverIconId } from "@/lib/blog-images/cover/icon-markup"

export type CoverFamily = "metier" | "papiers" | "chantier"

export const ICON_COUNT = 8

const TRADE_ICONS: Record<TradeId, { main: CoverIconId; related: CoverIconId[] }> = {
  plombier: { main: "droplets", related: ["wrench", "bath", "shower-head", "thermometer-sun"] },
  electricien: { main: "plug-zap", related: ["lamp", "cable", "hammer", "drill"] },
  macon: { main: "brick-wall", related: ["pickaxe", "construction", "hammer", "fence"] },
  peintre: { main: "paint-roller", related: ["paintbrush", "ruler", "house", "pencil-ruler"] },
  carreleur: { main: "grid-3x3", related: ["ruler", "bath", "hammer", "pencil-ruler"] },
  menuisier: { main: "axe", related: ["hammer", "drill", "ruler", "door-open"] },
  couvreur: { main: "house", related: ["hard-hat", "hammer", "construction", "ruler"] },
  plaquiste: { main: "layers", related: ["drill", "ruler", "hammer", "pencil-ruler"] },
  chauffagiste: { main: "flame", related: ["thermometer-sun", "wrench", "droplets", "pencil-ruler"] },
  serrurier: { main: "door-open", related: ["wrench", "hammer", "warehouse", "drill"] },
  paysagiste: { main: "shovel", related: ["fence", "pickaxe", "house", "ruler"] },
}

/** Sujets de papiers, du plus précis au plus général (texte sans accents). */
const PAPER_TOPICS: { key: RegExp; icon: CoverIconId }[] = [
  { key: /relance|impaye|retard|mise en demeure/, icon: "bell" },
  { key: /signature|signer|bon pour accord/, icon: "signature" },
  { key: /paiement|acompte|virement|tresorerie|encaisse/, icon: "hand-coins" },
  { key: /\btva\b|taux|calcul|prix|marge|chiffrage/, icon: "calculator" },
  { key: /mention|conformit|obligatoire|controle|checklist|liste de controle/, icon: "clipboard-check" },
  { key: /plateforme agreee|reforme|e-?facture|facture electronique|loi |reglement|legal/, icon: "scale" },
  { key: /facture|facturer|facturation|avoir/, icon: "receipt-text" },
  { key: /devis|metre|estimation/, icon: "file-text" },
  { key: /courrier|mail|email|envoi/, icon: "mail" },
]

const SITE_POOL: CoverIconId[] = ["hard-hat", "hammer", "wrench", "drill", "ruler", "pickaxe", "construction", "fence", "warehouse", "lamp", "cable", "paint-roller", "house", "brick-wall", "building-2", "pencil-ruler"]
const PAPER_POOL: CoverIconId[] = ["file-text", "receipt-text", "calculator", "euro", "mail", "bell", "calendar-clock", "stamp", "clipboard-check", "signature", "scale", "send", "hand-coins", "badge-check"]

/** Nombre pseudo-aléatoire fixé par la graine (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Graine d'un texte (même titre, même couverture). */
export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffled<T>(list: readonly T[], seed: number): T[] {
  const out = list.slice()
  const rand = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface CoverIcons {
  family: CoverFamily
  /** Huit icônes sans doublon, dans l'ordre des emplacements (0 et 4 : en bleu). */
  icons: CoverIconId[]
}

/** Icônes de la couverture d'après le titre et le mot-clé. */
export function pickCoverIcons(input: { title: string; keyword?: string | null }, seed = seedOf(input.title)): CoverIcons {
  const text = `${input.keyword ?? ""} ${input.title}`
  const folded = foldText(text)
  const trade = detectTrade(text)
  const used = new Set<CoverIconId>()
  const take = (id: CoverIconId | undefined): CoverIconId | null => {
    if (!id || used.has(id)) return null
    used.add(id)
    return id
  }
  const slots: (CoverIconId | null)[] = new Array(ICON_COUNT).fill(null)
  let family: CoverFamily

  if (trade) {
    family = "metier"
    const { main, related } = TRADE_ICONS[trade]
    slots[0] = take(main)
    slots[4] = take(related[0])
    // Papiers du devis : le lien avec Qonforme
    slots[5] = take("file-text")
    slots[6] = take(related.find((r) => r === "ruler") ?? related[1])
    slots[7] = take("calculator")
    const rest = shuffled([...related.slice(1), ...SITE_POOL], seed)
    for (let i = 0; i < ICON_COUNT; i++) if (!slots[i]) slots[i] = take(rest.find((r) => !used.has(r)))
  } else {
    const topics = PAPER_TOPICS.filter((t) => t.key.test(folded)).map((t) => t.icon)
    if (topics.length > 0) {
      family = "papiers"
      slots[0] = take(topics[0])
      slots[4] = take(topics.find((t) => !used.has(t)) ?? "euro")
      // Le bâtiment reste dans l'image
      slots[2] = take("hard-hat")
      slots[5] = take("house")
      const rest = shuffled(PAPER_POOL, seed)
      for (let i = 0; i < ICON_COUNT; i++) if (!slots[i]) slots[i] = take(rest.find((r) => !used.has(r)))
    } else {
      family = "chantier"
      slots[0] = take("hard-hat")
      slots[4] = take("wrench")
      const rest = shuffled(SITE_POOL, seed)
      for (let i = 0; i < ICON_COUNT; i++) if (!slots[i]) slots[i] = take(rest.find((r) => !used.has(r)))
    }
  }
  return { family, icons: slots.map((s) => s as CoverIconId) }
}
