/**
 * Modèles de mise en page des documents (Paramètres › Modèles de documents) :
 * cinq habillages des mêmes PDF (devis, factures, avoirs, bons de commande).
 *
 * Seul l'habillage change : couleurs, bandeau d'en-tête, filets, tête du
 * tableau, cadre du total. La place de chaque mention, les montants et le XML
 * Factur-X restent les mêmes : un modèle ne peut ni retirer une mention
 * obligatoire, ni rendre une facture invalide (couleurs sRGB, aucun effet de
 * transparence : PDF/A-3).
 *
 * « Classique » reproduit exactement les PDF d'avant les modèles (couleur
 * propre à chaque document : facture à la couleur de l'entreprise, devis vert,
 * avoir orange, bon de commande bleu).
 *
 * Choix enregistré dans `companies.document_templates` (migration
 * 20261010_document_templates.sql) : `{ "quote": "chantier", … }`. Sans la
 * colonne ou sans choix, « Classique ».
 */
import { rgb, type PDFPage } from "pdf-lib"

export type DocTemplate = "classique" | "chantier" | "moderne" | "epure" | "prestige"
export type TemplateDoc = "quote" | "invoice" | "credit_note" | "purchase_order"

export const DOC_TEMPLATES: { id: DocTemplate; name: string; desc: string; badge?: string }[] = [
  { id: "classique", name: "Classique", desc: "Filet de couleur sous l'en-tête, logo à gauche, titre à droite." },
  { id: "chantier", name: "Chantier", desc: "Bandeau sombre en tête, tableau souligné, total sur fond sombre.", badge: "Bâtiment" },
  { id: "moderne", name: "Moderne", desc: "Titre en couleur, parties sur fond teinté, total sur fond de couleur." },
  { id: "epure", name: "Épuré", desc: "Noir et blanc, filets fins. Économe en encre." },
  { id: "prestige", name: "Prestige", desc: "Double filet, titre en couleur, total encadré." },
]

export const TEMPLATE_DOCS: { id: TemplateDoc; label: string; plural: string }[] = [
  { id: "quote", label: "Devis", plural: "devis" },
  { id: "invoice", label: "Facture", plural: "factures" },
  { id: "credit_note", label: "Avoir", plural: "avoirs" },
  { id: "purchase_order", label: "Bon de commande", plural: "bons de commande" },
]

export type DocumentTemplates = Partial<Record<TemplateDoc, DocTemplate>>

export function isDocTemplate(v: unknown): v is DocTemplate {
  return typeof v === "string" && DOC_TEMPLATES.some((t) => t.id === v)
}

/** Modèles enregistrés, nettoyés (toute valeur inconnue est ignorée). */
export function parseDocumentTemplates(raw: unknown): DocumentTemplates {
  const out: DocumentTemplates = {}
  if (!raw || typeof raw !== "object") return out
  for (const d of TEMPLATE_DOCS) {
    const v = (raw as Record<string, unknown>)[d.id]
    if (isDocTemplate(v)) out[d.id] = v
  }
  return out
}

/** Modèle d'un document d'après l'entreprise passée aux générateurs (« Classique » par défaut). */
export function templateOf(company: object | null | undefined, doc: TemplateDoc): DocTemplate {
  const raw = company ? (company as { document_templates?: unknown }).document_templates : undefined
  return parseDocumentTemplates(raw)[doc] ?? "classique"
}

type Rgb = ReturnType<typeof rgb>

export interface PdfTheme {
  id: DocTemplate
  /** Couleur des repères : numéro, libellés « ÉMETTEUR / CLIENT », total. */
  primary: Rgb
  /** Couleur du titre du document (« FACTURE », « DEVIS »…). */
  title: Rgb
  /** Bandeau d'en-tête (fond) ; null : en-tête sur fond blanc. */
  band: Rgb | null
  /** Couleurs du texte de l'en-tête : principal, secondaire, discret, numéro. */
  head: { text: Rgb; sub: Rgb; faint: Rgb; number: Rgb }
  /** Séparation sous l'en-tête. */
  divider: "bar" | "thin" | "double" | "none"
  /** Fond derrière les parties (émetteur, client) ; null : aucun. */
  partiesFill: Rgb | null
  /** Tête du tableau : fond (null : aucun), texte, filet dessous (null : aucun). */
  tableHead: { fill: Rgb | null; text: Rgb; rule: Rgb | null }
  /** Total TTC : filet de couleur, fond plein, ou cadre. */
  total: { style: "rule" | "fill" | "outline"; fill: Rgb; text: Rgb }
}

const INK = rgb(0.04, 0.07, 0.13)          // #0A1122
const BLACK = rgb(0.06, 0.09, 0.17)
const GRAY_DARK = rgb(0.28, 0.34, 0.41)
const GRAY_LIGHT = rgb(0.58, 0.64, 0.70)
const WHITE = rgb(1, 1, 1)

/** Teinte claire d'une couleur (mélange avec du blanc, sans transparence : PDF/A). */
export function tint(c: Rgb, amount: number): Rgb {
  const mix = (v: number) => v + (1 - v) * (1 - amount)
  return rgb(mix(c.red), mix(c.green), mix(c.blue))
}

/**
 * Thème d'un document. Classique : `docColor` (couleur propre au document),
 * `classicTitle` (couleur de son titre) et `classicHeadFill` (fond de la tête
 * de tableau) reproduisent le rendu d'avant les modèles ; les autres modèles
 * reprennent `brand`, la couleur de l'entreprise (Paramètres › Préférences).
 */
export function pdfTheme(
  template: DocTemplate,
  { docColor, classicTitle, classicHeadFill, brand }: { docColor: Rgb; classicTitle: Rgb; classicHeadFill: Rgb; brand: Rgb },
): PdfTheme {
  switch (template) {
    case "chantier":
      return {
        id: template, primary: brand, title: WHITE, band: INK,
        head: { text: WHITE, sub: rgb(0.80, 0.84, 0.89), faint: rgb(0.62, 0.68, 0.76), number: tint(brand, 0.45) },
        divider: "none", partiesFill: null,
        tableHead: { fill: null, text: GRAY_DARK, rule: INK },
        total: { style: "fill", fill: INK, text: WHITE },
      }
    case "moderne":
      return {
        id: template, primary: brand, title: brand, band: null,
        head: { text: BLACK, sub: GRAY_DARK, faint: GRAY_LIGHT, number: brand },
        divider: "none", partiesFill: tint(brand, 0.08),
        tableHead: { fill: null, text: GRAY_DARK, rule: tint(brand, 0.35) },
        total: { style: "fill", fill: brand, text: WHITE },
      }
    case "epure":
      return {
        id: template, primary: BLACK, title: BLACK, band: null,
        head: { text: BLACK, sub: GRAY_DARK, faint: GRAY_LIGHT, number: BLACK },
        divider: "thin", partiesFill: null,
        tableHead: { fill: null, text: GRAY_DARK, rule: BLACK },
        total: { style: "rule", fill: BLACK, text: BLACK },
      }
    case "prestige":
      return {
        id: template, primary: brand, title: brand, band: null,
        head: { text: BLACK, sub: GRAY_DARK, faint: GRAY_LIGHT, number: GRAY_DARK },
        divider: "double", partiesFill: null,
        tableHead: { fill: null, text: GRAY_DARK, rule: BLACK },
        total: { style: "outline", fill: brand, text: brand },
      }
    default:
      return {
        id: "classique", primary: docColor, title: classicTitle, band: null,
        head: { text: BLACK, sub: GRAY_DARK, faint: GRAY_LIGHT, number: docColor },
        divider: "bar", partiesFill: null,
        tableHead: { fill: classicHeadFill, text: GRAY_DARK, rule: null },
        total: { style: "rule", fill: docColor, text: docColor },
      }
  }
}

/* ------------------------------------------------------------------ */
/* Habillage commun aux quatre générateurs                             */
/* ------------------------------------------------------------------ */

/** Bandeau d'en-tête sur toute la largeur, du haut de la page jusqu'à `bottom`. À dessiner en premier. */
export function drawHeaderBand(page: PDFPage, theme: PdfTheme, bottom: number): void {
  if (!theme.band) return
  const { width, height } = page.getSize()
  page.drawRectangle({ x: 0, y: bottom, width, height: height - bottom, color: theme.band })
}

/** Fond clair derrière le logo sur un bandeau sombre (un logo foncé resterait illisible). */
export function drawLogoBacking(page: PDFPage, theme: PdfTheme, box: { x: number; y: number; width: number; height: number }): void {
  if (!theme.band) return
  page.drawRectangle({ x: box.x - 5, y: box.y - 5, width: box.width + 10, height: box.height + 10, color: WHITE })
}

/** Séparation sous l'en-tête, à la hauteur `y` (le Classique : filet de 3 pt à sa couleur). */
export function drawDivider(page: PDFPage, theme: PdfTheme, x: number, w: number, y: number): void {
  switch (theme.divider) {
    case "bar": page.drawRectangle({ x, y, width: w, height: 3, color: theme.primary }); break
    case "thin": page.drawLine({ start: { x, y: y + 1 }, end: { x: x + w, y: y + 1 }, thickness: 0.8, color: BLACK }); break
    case "double":
      page.drawLine({ start: { x, y: y + 3 }, end: { x: x + w, y: y + 3 }, thickness: 0.8, color: BLACK })
      page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.8, color: BLACK })
      break
    default: break
  }
}

/** Fond des parties (émetteur, client), entre `top` et `bottom`. À dessiner avant leur texte. */
export function drawPartiesFill(page: PDFPage, theme: PdfTheme, x: number, w: number, top: number, bottom: number): void {
  if (!theme.partiesFill || top <= bottom) return
  page.drawRectangle({ x: x - 8, y: bottom, width: w + 16, height: top - bottom, color: theme.partiesFill })
}

/** Tête du tableau : fond ou filet, à la place du rectangle teinté du Classique. */
export function drawTableHead(page: PDFPage, theme: PdfTheme, x: number, y: number, w: number, h: number): void {
  if (theme.tableHead.fill) page.drawRectangle({ x, y, width: w, height: h, color: theme.tableHead.fill })
  if (theme.tableHead.rule) page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 1.2, color: theme.tableHead.rule })
}

/**
 * Habillage de la ligne « TOTAL TTC » dont le texte est dessiné à `baseline`
 * (filet au-dessus pour le Classique et l'Épuré, fond plein, ou cadre).
 */
export function drawTotalBox(page: PDFPage, theme: PdfTheme, x: number, w: number, baseline: number): void {
  const { style, fill } = theme.total
  if (style === "rule") {
    page.drawLine({ start: { x, y: baseline + 14 }, end: { x: x + w, y: baseline + 14 }, thickness: 1.5, color: fill })
  } else if (style === "fill") {
    page.drawRectangle({ x: x - 8, y: baseline - 7, width: w + 16, height: 24, color: fill })
  } else {
    page.drawRectangle({ x: x - 8, y: baseline - 7, width: w + 16, height: 24, borderColor: fill, borderWidth: 1.2 })
  }
}
