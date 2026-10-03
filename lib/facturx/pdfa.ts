/**
 * Transforme un PDF produit avec pdf-lib en Factur-X : PDF/A-3 (niveau B) avec
 * le XML embarqué comme fichier associé.
 *
 * Ce que ça pose, d'après la spécification Factur-X (FNFE-MPE / FeRD) et la
 * norme PDF/A-3 (ISO 19005-3) :
 * - fichier « factur-x.xml », type MIME text/xml, date de modification
 *   (Params/ModDate), relation « Alternative » (le PDF et le XML portent la même
 *   facture ; valeur prévue pour les profils BASIC, EN 16931 et EXTENDED),
 *   référencé dans le tableau /AF du catalogue et dans /Names/EmbeddedFiles ;
 * - métadonnées XMP non compressées : pdfaid:part 3, conformance B, schéma
 *   d'extension Factur-X (namespace urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#)
 *   avec DocumentType INVOICE, DocumentFileName factur-x.xml, Version 1.0,
 *   ConformanceLevel EN 16931, et les mêmes titre, auteur, sujet, mots-clés,
 *   producteur et dates que le dictionnaire Info ;
 * - intention de sortie GTS_PDFA1 avec le profil ICC sRGB embarqué (les
 *   couleurs du document sont en DeviceRGB) ;
 * - identifiant de fichier (/ID) dans la remorque ; aucun chiffrement.
 *
 * Les polices doivent déjà être embarquées (TrueType via fontkit) et le texte
 * ne doit pas appeler de glyphe absent (.notdef) : voir pdfSafeText().
 */
import { createHash } from "crypto"
import { AFRelationship, PDFDocument, PDFHexString, PDFName, PDFString, type PDFFont } from "pdf-lib"
import { SRGB_ICC_BASE64 } from "@/lib/facturx/srgb-icc"

export interface FacturXPdfOptions {
  xml: string
  title: string
  author: string
  subject: string
  keywords: string[]
  /** Date de création et de modification (à la seconde). */
  date?: Date
}

const CREATOR = "Qonforme"
const PRODUCER = "Qonforme (pdf-lib)"

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Date XMP (ISO 8601, UTC, à la seconde), identique à la date PDF « D:AAAAMMJJHHmmSSZ ». */
function xmpDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z")
}

function xmpPacket(o: Required<Omit<FacturXPdfOptions, "xml">>): string {
  const date = xmpDate(o.date)
  const prop = (name: string, description: string) => `
              <rdf:li rdf:parseType="Resource">
                <pdfaProperty:name>${name}</pdfaProperty:name>
                <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                <pdfaProperty:category>external</pdfaProperty:category>
                <pdfaProperty:description>${description}</pdfaProperty:description>
              </rdf:li>`
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(o.title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${xmlEscape(o.author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(o.subject)}</rdf:li></rdf:Alt></dc:description>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${xmlEscape(PRODUCER)}</pdf:Producer>
      <pdf:Keywords>${xmlEscape(o.keywords.join(" "))}</pdf:Keywords>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${xmlEscape(CREATOR)}</xmp:CreatorTool>
      <xmp:CreateDate>${date}</xmp:CreateDate>
      <xmp:ModifyDate>${date}</xmp:ModifyDate>
      <xmp:MetadataDate>${date}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>${prop("DocumentFileName", "The name of the embedded XML document")}${prop("DocumentType", "The type of the hybrid document in capital letters, e.g. INVOICE or ORDER")}${prop("Version", "The actual version of the standard applying to the embedded XML document")}${prop("ConformanceLevel", "The conformance level of the embedded XML document")}
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

/**
 * Embarque le XML, pose les métadonnées PDF/A-3 et renvoie le PDF enregistré.
 * À appeler une fois toutes les pages dessinées.
 */
export async function saveAsFacturX(doc: PDFDocument, options: FacturXPdfOptions): Promise<Uint8Array> {
  // Dates à la seconde : le dictionnaire Info et le XMP doivent dire la même chose
  const date = new Date(Math.floor((options.date ?? new Date()).getTime() / 1000) * 1000)
  const meta = { title: options.title, author: options.author, subject: options.subject, keywords: options.keywords, date }

  doc.setTitle(meta.title)
  doc.setAuthor(meta.author)
  doc.setSubject(meta.subject)
  doc.setKeywords(meta.keywords)
  doc.setCreator(CREATOR)
  doc.setProducer(PRODUCER)
  doc.setCreationDate(date)
  doc.setModificationDate(date)

  // Fichier associé factur-x.xml
  await doc.attach(new TextEncoder().encode(options.xml), "factur-x.xml", {
    mimeType: "text/xml",
    description: "Factur-X",
    creationDate: date,
    modificationDate: date,
    afRelationship: AFRelationship.Alternative,
  })

  const ctx = doc.context

  // Métadonnées XMP (flux non filtré, exigé par PDF/A)
  const xmp = ctx.stream(new TextEncoder().encode(xmpPacket(meta)), { Type: "Metadata", Subtype: "XML" })
  doc.catalog.set(PDFName.of("Metadata"), ctx.register(xmp))

  // Intention de sortie sRGB
  const icc = ctx.flateStream(Buffer.from(SRGB_ICC_BASE64, "base64"), { N: 3 })
  const outputIntent = ctx.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    RegistryName: PDFString.of("http://www.color.org"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: ctx.register(icc),
  })
  doc.catalog.set(PDFName.of("OutputIntents"), ctx.obj([ctx.register(outputIntent)]))

  // Identifiant du fichier
  const id = createHash("md5").update(`${options.title}|${date.toISOString()}|${options.xml.length}`).digest("hex")
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(id), PDFHexString.of(id)])

  return doc.save({ useObjectStreams: false })
}

/**
 * Texte imprimable avec la police : PDF/A interdit d'appeler un glyphe absent
 * (.notdef). Les caractères inconnus de la police (émoji, symboles…) sont
 * retirés, les espaces spéciaux et retours à la ligne deviennent des espaces.
 */
export function pdfSafeText(font: PDFFont, text: string): string {
  const supported = charsetCache.get(font) ?? new Set(font.getCharacterSet())
  charsetCache.set(font, supported)
  let out = ""
  for (const ch of text ?? "") {
    const cp = ch.codePointAt(0)!
    if (ch === "\n" || ch === "\r" || ch === "\t") out += " "
    else if (supported.has(cp)) out += ch
    else if (/\s/.test(ch)) out += " "
  }
  return out
}

const charsetCache = new WeakMap<PDFFont, Set<number>>()
