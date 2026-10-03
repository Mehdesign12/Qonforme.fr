/**
 * Lecture d'un fichier de facture reçue, en mémoire : PDF Factur-X (XML
 * embarqué), XML CII, XML UBL 2.1, ou PDF simple (sans données structurées,
 * classé ensuite avec une saisie minimale).
 *
 * Rien n'est enregistré ici. Le type est reconnu par le contenu du fichier,
 * jamais par son extension ni par le type annoncé par le navigateur.
 */
import { decodeXmlBytes, MAX_UPLOAD_BYTES, sniffKind } from "@/lib/reception/bytes"
import { isCiiRoot, parseCii } from "@/lib/reception/cii"
import { scanPdfAttachments } from "@/lib/reception/pdf"
import { isUblRoot, parseUbl } from "@/lib/reception/ubl"
import { parseXml, XmlError, type XmlElement } from "@/lib/reception/xml"
import type { FileAnalysis, ParsedInvoice } from "@/lib/reception/types"

/** Lit un document XML de facture (CII ou UBL) ; null si ce n'en est pas un. */
function readInvoiceXml(root: XmlElement): ParsedInvoice | null {
  if (isCiiRoot(root)) return parseCii(root)
  if (isUblRoot(root)) return parseUbl(root)
  return null
}

export async function analyzeFile(bytes: Uint8Array): Promise<FileAnalysis> {
  if (bytes.byteLength === 0) return { ok: false, code: "empty", message: "Le fichier est vide." }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "too_large", message: "Fichier trop lourd : 4 Mo au maximum." }
  }

  const kind = sniffKind(bytes)
  if (!kind) {
    return { ok: false, code: "unsupported", message: "Format non reconnu : déposez un PDF (Factur-X ou simple) ou un fichier XML (CII ou UBL)." }
  }

  if (kind === "xml") {
    let root: XmlElement
    try {
      root = parseXml(decodeXmlBytes(bytes))
    } catch (e) {
      if (e instanceof XmlError) return { ok: false, code: `xml_${e.code}`, message: e.message }
      throw e
    }
    const invoice = readInvoiceXml(root)
    if (!invoice) {
      return {
        ok: false,
        code: "not_invoice",
        message: "Ce fichier XML n'est pas une facture électronique reconnue (CII ou UBL 2.1).",
      }
    }
    return { ok: true, kind: "structured", format: invoice.syntax === "CII" ? "cii" : "ubl", invoice, has_pdf: false }
  }

  // PDF : on cherche le XML Factur-X joint
  const scan = await scanPdfAttachments(bytes)
  let xmlError: string | null = null
  for (const f of scan.files) {
    let root: XmlElement
    try {
      root = parseXml(decodeXmlBytes(f.bytes))
    } catch (e) {
      if (e instanceof XmlError) { xmlError = e.message; continue }
      throw e
    }
    const invoice = readInvoiceXml(root)
    // Un PDF qui joint un CII est un Factur-X ; un UBL joint garde son nom
    if (invoice) return { ok: true, kind: "structured", format: invoice.syntax === "CII" ? "facturx" : "ubl", invoice, has_pdf: true }
  }

  const note = scan.encrypted
    ? "Ce PDF est protégé : ses données de facture ne peuvent pas être lues. Saisissez l'essentiel ci-dessous."
    : xmlError
      ? `Le XML joint à ce PDF n'a pas pu être lu (${xmlError.replace(/\.$/, "")}). Saisissez l'essentiel ci-dessous.`
      : scan.files.length > 0 || scan.skipped > 0
        ? "Ce PDF contient des pièces jointes, mais aucune facture électronique lisible. Saisissez l'essentiel ci-dessous."
        : null
  return { ok: true, kind: "pdf_only", format: "pdf", has_pdf: true, note }
}
