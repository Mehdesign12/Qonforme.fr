/**
 * Lien cliquable dans un PDF (annotation /Link avec une action /URI), sans
 * dépendance. Compatible PDF/A-3 (Factur-X) : drapeau d'impression posé
 * (/F 4, ISO 19005-3 § 6.3.2), action URI autorisée, pas de bordure ; une
 * annotation Link n'a pas besoin d'apparence (§ 6.3.3).
 */
import { PDFString, type PDFDocument, type PDFPage } from "pdf-lib"

export function addUriLink(
  doc: PDFDocument,
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  url: string,
): void {
  if (!/^https?:\/\//.test(url)) return
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
    Border: [0, 0, 0],
    F: 4,
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  })
  page.node.addAnnot(doc.context.register(annot))
}
