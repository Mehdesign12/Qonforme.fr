/**
 * Pictogrammes de marque : les 42 icônes au trait fin des couvertures d'articles
 * (lib/blog-images/cover/icon-markup.ts), en composants Lucide pour les pages.
 *
 * Le choix suit la même règle que les couvertures (pickCoverIcons) : un métier
 * reconnu dans le sujet donne ses outils, un sujet de papiers (devis, facture,
 * TVA, relance…) ses documents avec un casque et une maison, sinon le chantier.
 * Une page et l'article du même sujet portent donc les mêmes pictogrammes.
 *
 * Ce module charge les 42 icônes : à garder côté serveur (pages publiques). Les
 * composants clients prennent quelques icônes choisies à la main.
 */
import {
  Axe, BadgeCheck, Bath, Bell, BrickWall, Building2, Cable, CalendarClock, Calculator, ClipboardCheck,
  Construction, DoorOpen, Drill, Droplets, Euro, Fence, FileText, Flame, Grid3x3, HandCoins, Hammer,
  HardHat, House, Lamp, Layers, Mail, PaintRoller, Paintbrush, PencilRuler, Pickaxe, PlugZap, ReceiptText,
  Ruler, Scale, Send, Shovel, ShowerHead, Signature, Stamp, ThermometerSun, Warehouse, Wrench,
  type LucideIcon,
} from "lucide-react"
import type { CoverIconId } from "@/lib/blog-images/cover/icon-markup"
import { pickCoverIcons } from "@/lib/blog-images/cover/icons"

export const PICTOS: Record<CoverIconId, LucideIcon> = {
  "hard-hat": HardHat,
  hammer: Hammer,
  wrench: Wrench,
  "paint-roller": PaintRoller,
  paintbrush: Paintbrush,
  ruler: Ruler,
  drill: Drill,
  house: House,
  "building-2": Building2,
  "brick-wall": BrickWall,
  "plug-zap": PlugZap,
  droplets: Droplets,
  "thermometer-sun": ThermometerSun,
  "pencil-ruler": PencilRuler,
  construction: Construction,
  pickaxe: Pickaxe,
  shovel: Shovel,
  "shower-head": ShowerHead,
  fence: Fence,
  lamp: Lamp,
  warehouse: Warehouse,
  cable: Cable,
  bath: Bath,
  flame: Flame,
  layers: Layers,
  "grid-3x3": Grid3x3,
  axe: Axe,
  "door-open": DoorOpen,
  "file-text": FileText,
  "receipt-text": ReceiptText,
  calculator: Calculator,
  euro: Euro,
  mail: Mail,
  bell: Bell,
  "calendar-clock": CalendarClock,
  stamp: Stamp,
  "clipboard-check": ClipboardCheck,
  signature: Signature,
  scale: Scale,
  send: Send,
  "hand-coins": HandCoins,
  "badge-check": BadgeCheck,
}

/**
 * Pictogrammes d'un sujet, rangés comme les couvertures : `accent` (le sujet, en
 * bleu plein) puis `soft` (son univers, en bleu pâle). Même sujet, mêmes icônes.
 */
export function pictosFor(topic: string, keyword?: string | null): { accent: LucideIcon[]; soft: LucideIcon[] } {
  const { icons } = pickCoverIcons({ title: topic, keyword })
  const all = icons.map((id) => PICTOS[id])
  // Couverture : emplacements 0 et 4 en bleu, les six autres en bleu pâle
  return { accent: [all[0], all[4]], soft: all.filter((_, i) => i !== 0 && i !== 4) }
}
