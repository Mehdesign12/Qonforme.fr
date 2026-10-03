/**
 * PDF signé : le PDF du document (lib/pdf/quote.ts ou purchase-order.ts, non
 * modifiés) reçoit une mention de signature en pied de chaque page, puis une
 * page « Bon pour accord » avec le bloc de signature et le dossier de preuve.
 *
 * Vocabulaire : « signature électronique simple » uniquement, jamais
 * « certifiée » ni « qualifiée » (DECISIONS-STRATEGIQUES.md § 11).
 */
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import path from "path"
import fs from "fs"
import { EVENT_LABELS } from "@/lib/signature/rules"
import type { ClientKind, SignatureConsents, SignatureContext, SignatureEvent, SignatureMethod } from "@/lib/signature/types"

export interface SignedPdfInput {
  /** PDF du document tel qu'il a été présenté et accepté. */
  original: Uint8Array
  docLabel: "Devis" | "Bon de commande"
  docNumber: string
  companyName: string
  version: number
  totalTtc: number
  contentSha256: string
  /** Empreinte SHA-256 du PDF original (avant ajout de ce dossier). */
  documentSha256: string
  signer: { name: string; email: string; role?: string | null; company?: string | null }
  clientOrderNumber?: string | null
  clientKind: ClientKind
  method: SignatureMethod
  imagePng?: Uint8Array | null
  typedName?: string | null
  context: SignatureContext
  consents: Partial<SignatureConsents>
  /** Texte certifié pour le taux réduit de TVA, s'il y en a un. */
  reducedVatText?: string | null
  signedAt: Date
  ip: string | null
  userAgent: string | null
  code?: { verifiedAt: Date; sentTo: string | null } | null
  events: SignatureEvent[]
}

const INK = rgb(0.06, 0.09, 0.17)
const GRAY = rgb(0.33, 0.39, 0.47)
const LIGHT = rgb(0.58, 0.64, 0.7)
const LINE = rgb(0.89, 0.91, 0.94)
const ACCENT = rgb(0.15, 0.39, 0.92)
const WASH = rgb(0.94, 0.96, 1)

/** « 03/10/2026 à 14:32:05 » à l'heure de Paris. */
export function parisDateTime(d: Date): string {
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(d)
  return `${date} à ${time}`
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0).replace(/ /g, " ")
}

/** Coupe un texte en lignes qui tiennent dans `maxWidth`. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ""
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue }
      if (line) out.push(line)
      // Mot plus long que la ligne (empreinte, navigateur) : coupé au caractère
      let rest = w
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let i = rest.length
        while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > maxWidth) i--
        out.push(rest.slice(0, i))
        rest = rest.slice(i)
      }
      line = rest
    }
    out.push(line)
  }
  return out
}

/** Le PDF signé (octets). */
export async function buildSignedPdf(input: SignedPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.original)
  doc.registerFontkit(fontkit)
  const fontsDir = path.join(process.cwd(), "public", "fonts")
  const regular = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Regular.ttf")), { subset: true })
  const bold = await doc.embedFont(fs.readFileSync(path.join(fontsDir, "Roboto-Bold.ttf")), { subset: true })

  const when = parisDateTime(input.signedAt)

  /* ── Mention en pied de chaque page du document ── */
  const stamp = `Signé électroniquement par ${input.signer.name} le ${when} (heure de Paris) · signature électronique simple · dossier de preuve en dernière page`
  for (const page of doc.getPages()) {
    const { width } = page.getSize()
    const size = 6.5
    let text = stamp
    while (text.length > 20 && regular.widthOfTextAtSize(text, size) > width - 96) text = text.slice(0, -2)
    if (text !== stamp) text = `${text.trimEnd()}…`
    page.drawText(text, { x: 48, y: 9, size, font: regular, color: GRAY })
  }

  /* ── Page « Bon pour accord » et dossier de preuve ── */
  let page: PDFPage = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()
  const mL = 48
  const mR = width - 48
  const cW = mR - mL
  let y = height - 56

  const newPageIfNeeded = (needed: number) => {
    if (y - needed > 48) return
    page = doc.addPage(PageSizes.A4)
    y = height - 56
  }
  const text = (s: string, x: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(s, { x, y, size: opts.size ?? 9, font: opts.font ?? regular, color: opts.color ?? INK })
  }
  const paragraph = (s: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 9
    const x = mL + (opts.indent ?? 0)
    for (const l of wrap(s, opts.font ?? regular, size, mR - x)) {
      newPageIfNeeded(size + 4)
      text(l, x, opts)
      y -= size + (opts.gap ?? 4)
    }
  }

  text(`${input.docLabel} ${input.docNumber}`, mL, { size: 9, color: GRAY })
  page.drawText(input.companyName, { x: mR - regular.widthOfTextAtSize(input.companyName, 9), y, size: 9, font: regular, color: GRAY })
  y -= 30
  text("Bon pour accord", mL, { size: 22, font: bold })
  y -= 18
  paragraph(`Signature électronique simple du ${input.docLabel.toLowerCase()} ${input.docNumber} (${fmtEur(input.totalTtc)} TTC).`, { color: GRAY, size: 10 })
  y -= 10

  /* Bloc de signature */
  const boxH = 150
  const boxTop = y
  page.drawRectangle({ x: mL, y: boxTop - boxH, width: cW, height: boxH, color: WASH, borderColor: LINE, borderWidth: 1 })
  const colX = mL + 18
  y = boxTop - 24
  text("« Bon pour accord »", colX, { size: 11, font: bold })
  y -= 20
  text(input.signer.name, colX, { size: 12, font: bold })
  y -= 15
  const who = [input.signer.role, input.signer.company].filter(Boolean).join(", ")
  if (who) { text(who, colX, { size: 9, color: GRAY }); y -= 13 }
  text(input.signer.email, colX, { size: 9, color: GRAY })
  y -= 13
  text(`Le ${when} (heure de Paris)`, colX, { size: 9, color: GRAY })
  y -= 13
  if (input.clientOrderNumber) { text(`Numéro de commande du client : ${input.clientOrderNumber}`, colX, { size: 9, color: GRAY }); y -= 13 }

  // Signature à droite du bloc
  const sigX = mL + cW / 2 + 20
  const sigW = cW / 2 - 40
  const sigH = 90
  const sigY = boxTop - 28 - sigH
  page.drawLine({ start: { x: sigX, y: sigY - 4 }, end: { x: sigX + sigW, y: sigY - 4 }, thickness: 0.6, color: LIGHT })
  page.drawText(input.method === "drawn" ? "Signature tracée" : "Signature par nom saisi", { x: sigX, y: sigY - 16, size: 7.5, font: regular, color: LIGHT })
  if (input.method === "drawn" && input.imagePng) {
    try {
      const img = await doc.embedPng(input.imagePng)
      const scale = Math.min(sigW / img.width, sigH / img.height, 1)
      page.drawImage(img, { x: sigX, y: sigY, width: img.width * scale, height: img.height * scale })
    } catch {
      page.drawText("(image de signature illisible)", { x: sigX, y: sigY + 30, size: 9, font: regular, color: GRAY })
    }
  } else if (input.typedName) {
    let size = 24
    while (size > 10 && bold.widthOfTextAtSize(input.typedName, size) > sigW) size -= 1
    page.drawText(input.typedName, { x: sigX, y: sigY + 30, size, font: bold, color: ACCENT })
  }
  y = boxTop - boxH - 24

  /* Consentements */
  text("Ce que le signataire a accepté", mL, { size: 11, font: bold })
  y -= 16
  paragraph(`• Bon pour accord sur le ${input.docLabel.toLowerCase()} ${input.docNumber}, lu en entier avant la signature.`, { indent: 4 })
  if (input.consents.reduced_vat_certified && input.reducedVatText) {
    paragraph(`• Certification pour le taux réduit de TVA : « ${input.reducedVatText} »`, { indent: 4 })
  }
  if (input.clientKind === "consumer") {
    paragraph("• Information sur le droit de rétractation de 14 jours (Code de la consommation, art. L221-18), avec le formulaire de rétractation envoyé par email.", { indent: 4 })
    paragraph(input.consents.early_start_requested
      ? "• Demande expresse de démarrage des travaux avant la fin du délai de rétractation (art. L221-25)."
      : "• Pas de demande de démarrage avant la fin du délai de rétractation.", { indent: 4 })
  }
  if (input.context === "in_person") {
    paragraph("• Signature sur place, sur l'appareil de l'entreprise (contrat conclu hors établissement).", { indent: 4 })
    if (input.consents.durable_medium_by_email) paragraph("• Accord pour recevoir son exemplaire par email (support durable, art. L221-9).", { indent: 4 })
  }
  y -= 10

  /* Dossier de preuve */
  newPageIfNeeded(80)
  text("Dossier de preuve", mL, { size: 11, font: bold })
  y -= 16
  const rows: [string, string][] = [
    ["Document", `${input.docLabel} ${input.docNumber}, version ${input.version}, émis par ${input.companyName}`],
    ["Empreinte SHA-256 du document signé (PDF d'origine, avant ce dossier)", input.documentSha256],
    ["Empreinte SHA-256 du contenu", input.contentSha256],
    ["Signataire", [input.signer.name, input.signer.email, who].filter(Boolean).join(" · ")],
    ["Méthode", input.method === "drawn" ? "Signature tracée à l'écran" : "Nom saisi au clavier"],
    ["Vérification par code", input.code ? `Code à 6 chiffres envoyé à ${input.code.sentTo ?? "l'adresse du client"}, validé le ${parisDateTime(input.code.verifiedAt)}` : "Non demandée pour ce document"],
    ["Contexte", input.context === "in_person" ? "Sur place, sur l'appareil de l'entreprise" : "À distance, par lien personnel"],
    ["Horodatage (serveur)", `${when} (heure de Paris) · ${input.signedAt.toISOString()}`],
    ["Adresse IP", input.ip ?? "Non disponible"],
    ["Appareil", input.userAgent ?? "Non disponible"],
  ]
  const labelW = 150
  for (const [label, value] of rows) {
    const lines = wrap(value, regular, 8.5, cW - labelW)
    const labelLines = wrap(label, bold, 8.5, labelW - 10)
    const n = Math.max(lines.length, labelLines.length)
    newPageIfNeeded(n * 12 + 6)
    for (let i = 0; i < n; i++) {
      if (labelLines[i]) page.drawText(labelLines[i], { x: mL, y, size: 8.5, font: bold, color: GRAY })
      if (lines[i]) page.drawText(lines[i], { x: mL + labelW, y, size: 8.5, font: regular, color: INK })
      y -= 12
    }
    page.drawLine({ start: { x: mL, y: y + 4 }, end: { x: mR, y: y + 4 }, thickness: 0.4, color: LINE })
    y -= 4
  }
  y -= 8

  /* Journal */
  if (input.events.length > 0) {
    newPageIfNeeded(40)
    text("Journal des événements", mL, { size: 11, font: bold })
    y -= 16
    for (const e of input.events) {
      newPageIfNeeded(14)
      const label = EVENT_LABELS[e.type] ?? e.type
      text(parisDateTime(new Date(e.created_at)), mL, { size: 8.5, color: GRAY })
      page.drawText(`${label}${e.ip ? ` · IP ${e.ip}` : ""}`, { x: mL + labelW, y, size: 8.5, font: regular, color: INK })
      y -= 13
    }
    y -= 8
  }

  newPageIfNeeded(60)
  paragraph(
    "Signature électronique simple au sens du règlement (UE) n° 910/2014 (eIDAS) et des articles 1366 et 1367 du Code civil. " +
    "Le signataire a été identifié par son lien personnel" + (input.code ? " et par un code envoyé à son adresse email" : "") +
    "; l'intégrité du document est vérifiable par son empreinte SHA-256. Établi par Qonforme pour le compte de " + input.companyName + ".",
    { size: 7.5, color: LIGHT, gap: 3 },
  )

  return doc.save()
}
