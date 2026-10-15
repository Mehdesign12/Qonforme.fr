/**
 * Modèle de devis au format Excel (.xlsx), écrit à la main en SpreadsheetML :
 * archive ZIP de cinq fichiers XML, sans dépendance. Une feuille « Devis » dont
 * les totaux se calculent seuls : total de chaque ligne, TVA par taux, total
 * TTC, acompte et reste à payer. Les cellules à remplir sont encadrées.
 *
 * Norme : ECMA-376 / ISO 29500, parties 1 (SpreadsheetML) et 2 (OPC). Les
 * textes sont en `inlineStr` (pas de table de chaînes partagées) ; Excel
 * recalcule les formules à l'ouverture (`fullCalcOnLoad`). Validé par
 * LibreOffice dans le test (valeurs recalculées relues).
 */
import { createZip } from "@/lib/accountant/zip"
import {
  BANDEAU_EXEMPLE, CLIENT, COLONNES, CONDITIONS_TEXTE, CONDITIONS_TITRE, DATE_ARCHIVE, ENTREPRISE, INFOS, LIBELLE_ACOMPTE,
  LIBELLE_RESTE, LIBELLE_TOTAL_HT, LIBELLE_TTC, LIBELLE_TVA_AUTRE, MENTIONS, MENTIONS_TITRE, OBJET_LIBELLE, PIED, SIGNATURE,
  TAUX_FIXES, lignesAffichees, type OptionsModele,
} from "./devis"
import { xml } from "./devis-docx"

/** Largeurs des colonnes A à F (en caractères). */
const LARGEURS = [42, 9, 10, 24, 11, 17]
const LARGEUR_TOTALE = LARGEURS.reduce((a, b) => a + b, 0)

/* Index des styles (cellXfs) définis dans STYLES, dans cet ordre. */
const S = {
  defaut: 0,
  titre: 1,
  section: 2,
  champ: 3,
  libelle: 4,
  saisie: 5,
  entete: 6,
  texte: 7,
  quantite: 8,
  argent: 9,
  nombre: 10,
  totalLibelle: 11,
  totalArgent: 12,
  note: 13,
  texteLong: 14,
  bandeau: 15,
  signature: 16,
  saisiePourcent: 17,
  texteCentre: 18,
} as const

function lettre(i: number): string {
  return String.fromCharCode(65 + i)
}

interface Cell {
  /** Colonne 0-based. */
  c: number
  style: number
  texte?: string
  nombre?: number
  formule?: string
}

interface Row {
  r: number
  cells: Cell[]
  hauteur?: number
}

/** Lignes de texte long (cellules fusionnées) : Excel n'ajuste pas leur hauteur, on l'estime. */
const hauteurTexte = (texte: string, pt = 15) => Math.max(pt, Math.ceil(texte.length / (LARGEUR_TOTALE * 0.95)) * pt)

function construireFeuille(options: OptionsModele): string {
  const rows: Row[] = []
  const fusions: string[] = []
  let r = 0
  const nouvelle = (hauteur?: number): Row => {
    r += 1
    const row: Row = { r, cells: [], hauteur }
    rows.push(row)
    return row
  }
  /** Texte étalé sur A à F (fusion) ; le style est posé sur chaque case de la fusion. */
  const pleineLargeur = (row: Row, texte: string, style: number, de = 0, a = 5) => {
    row.cells.push({ c: de, style, texte })
    for (let c = de + 1; c <= a; c++) row.cells.push({ c, style })
    if (a > de) fusions.push(`${lettre(de)}${row.r}:${lettre(a)}${row.r}`)
  }
  const saut = () => nouvelle(8)

  // Titre
  const t = nouvelle(34)
  pleineLargeur(t, options.titre, S.titre)
  if (options.exempleFictif) {
    const b = nouvelle(hauteurTexte(BANDEAU_EXEMPLE))
    pleineLargeur(b, BANDEAU_EXEMPLE, S.bandeau)
  }
  saut()

  // Entreprise et client côte à côte : A à C, D à F
  const tete = nouvelle(20)
  pleineLargeur(tete, "VOTRE ENTREPRISE", S.section, 0, 2)
  pleineLargeur(tete, "CLIENT", S.section, 3, 5)
  for (let i = 0; i < ENTREPRISE.length; i++) {
    const l = nouvelle(34)
    pleineLargeur(l, ENTREPRISE[i], S.champ, 0, 2)
    pleineLargeur(l, CLIENT[i], S.champ, 3, 5)
  }
  saut()

  // Informations du devis : libellé puis case à remplir, deux par ligne
  for (const [gauche, droite] of INFOS) {
    const l = nouvelle(34)
    l.cells.push({ c: 0, style: S.libelle, texte: gauche })
    l.cells.push({ c: 1, style: S.saisie, texte: "" }, { c: 2, style: S.saisie })
    fusions.push(`B${l.r}:C${l.r}`)
    l.cells.push({ c: 3, style: S.libelle, texte: droite })
    l.cells.push({ c: 4, style: S.saisie, texte: "" }, { c: 5, style: S.saisie })
    fusions.push(`E${l.r}:F${l.r}`)
  }
  saut()

  // Objet
  const o = nouvelle(20)
  pleineLargeur(o, OBJET_LIBELLE, S.section)
  const objet = options.objet ?? "[Nature des travaux et adresse du chantier]"
  const ob = nouvelle(Math.max(34, hauteurTexte(objet)))
  pleineLargeur(ob, objet, options.objet ? S.texteLong : S.champ)
  saut()

  // Table des prestations
  const entete = nouvelle(28)
  COLONNES.forEach((nom, c) => entete.cells.push({ c, style: S.entete, texte: nom }))
  const lignes = lignesAffichees(options)
  const premiere = r + 1
  lignes.forEach((l) => {
    const row = nouvelle(22)
    row.cells.push({ c: 0, style: S.texte, texte: l.designation ?? "" })
    row.cells.push(l.quantite !== undefined ? { c: 1, style: S.quantite, nombre: l.quantite } : { c: 1, style: S.quantite })
    row.cells.push({ c: 2, style: S.texteCentre, texte: l.unite ?? "" })
    row.cells.push(l.prixHT !== undefined ? { c: 3, style: S.argent, nombre: l.prixHT } : { c: 3, style: S.argent })
    row.cells.push(l.tva !== undefined ? { c: 4, style: S.nombre, nombre: l.tva } : { c: 4, style: S.nombre })
    row.cells.push({ c: 5, style: S.argent, formule: `IF(OR(B${row.r}="",D${row.r}=""),"",ROUND(B${row.r}*D${row.r},2))` })
  })
  const derniere = r
  saut()

  // Totaux : libellé en D:E, montant en F
  const plage = (col: string) => `$${col}$${premiere}:$${col}$${derniere}`
  const total = (libelle: string, style: number, formule: string, valeurE?: Cell) => {
    const row = nouvelle(20)
    row.cells.push({ c: 3, style: S.totalLibelle, texte: libelle })
    row.cells.push(valeurE ?? { c: 4, style: S.totalLibelle })
    row.cells.push({ c: 5, style, formule })
    if (!valeurE) fusions.push(`D${row.r}:E${row.r}`)
    return row.r
  }
  const rHT = total(LIBELLE_TOTAL_HT, S.totalArgent, `SUM(F${premiere}:F${derniere})`)
  const rTva: number[] = []
  for (const taux of TAUX_FIXES) {
    const row = nouvelle(20)
    row.cells.push({ c: 3, style: S.totalLibelle, texte: `TVA ${String(taux).replace(".", ",")} %` })
    row.cells.push({ c: 4, style: S.totalLibelle })
    fusions.push(`D${row.r}:E${row.r}`)
    row.cells.push({ c: 5, style: S.argent, formule: `ROUND(SUMIF(${plage("E")},${taux},${plage("F")})*${taux}/100,2)` })
    rTva.push(row.r)
  }
  // Autre taux (2,1 %, taux d'outre-mer…) : le taux se saisit dans la case E
  const autre = nouvelle(20)
  autre.cells.push({ c: 3, style: S.totalLibelle, texte: LIBELLE_TVA_AUTRE })
  autre.cells.push({ c: 4, style: S.saisiePourcent })
  autre.cells.push({ c: 5, style: S.argent, formule: `IF(E${autre.r}="",0,ROUND(SUMIF(${plage("E")},E${autre.r},${plage("F")})*E${autre.r}/100,2))` })
  rTva.push(autre.r)
  const rTTC = total(LIBELLE_TTC, S.totalArgent, `F${rHT}+${rTva.map((x) => `F${x}`).join("+")}`)
  const ac = nouvelle(20)
  ac.cells.push({ c: 3, style: S.totalLibelle, texte: LIBELLE_ACOMPTE })
  ac.cells.push({ c: 4, style: S.saisiePourcent })
  ac.cells.push({ c: 5, style: S.argent, formule: `IF(E${ac.r}="",0,ROUND(F${rTTC}*E${ac.r}/100,2))` })
  total(LIBELLE_RESTE, S.totalArgent, `F${rTTC}-F${ac.r}`)
  saut()

  // Conditions, mentions, signature
  const ct = nouvelle(20)
  pleineLargeur(ct, CONDITIONS_TITRE, S.section)
  if (options.conditions?.length) {
    for (const c of options.conditions) {
      const cx = nouvelle(hauteurTexte(c) + 2)
      pleineLargeur(cx, `•  ${c}`, S.texteLong)
    }
  } else {
    const cx = nouvelle(hauteurTexte(CONDITIONS_TEXTE))
    pleineLargeur(cx, CONDITIONS_TEXTE, S.champ)
  }
  saut()
  const mt = nouvelle(20)
  pleineLargeur(mt, MENTIONS_TITRE, S.section)
  for (const m of [...MENTIONS, ...(options.mentionsMetier ?? [])]) {
    const row = nouvelle(hauteurTexte(m) + 2)
    pleineLargeur(row, `•  ${m}`, S.note)
  }
  saut()
  const st = nouvelle(20)
  pleineLargeur(st, SIGNATURE, S.section)
  const sg = nouvelle(70)
  pleineLargeur(sg, "", S.signature)
  saut()
  const pied = nouvelle(hauteurTexte(PIED, 13))
  pleineLargeur(pied, PIED, S.note)

  // Sérialisation : cases triées par colonne (ordre exigé par la norme)
  const cellXml = (row: Row, c: Cell) => {
    const ref = `${lettre(c.c)}${row.r}`
    if (c.formule !== undefined) return `<c r="${ref}" s="${c.style}"><f>${xml(c.formule)}</f></c>`
    if (c.nombre !== undefined) return `<c r="${ref}" s="${c.style}"><v>${c.nombre}</v></c>`
    if (c.texte) return `<c r="${ref}" s="${c.style}" t="inlineStr"><is><t xml:space="preserve">${xml(c.texte)}</t></is></c>`
    return `<c r="${ref}" s="${c.style}"/>`
  }
  const sheetData = rows
    .map((row) => {
      const cells = [...row.cells].sort((a, b) => a.c - b.c).map((c) => cellXml(row, c)).join("")
      return `<row r="${row.r}"${row.hauteur ? ` ht="${row.hauteur}" customHeight="1"` : ""}>${cells}</row>`
    })
    .join("")
  const cols = LARGEURS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")
  const validation =
    `<dataValidations count="1"><dataValidation type="decimal" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="Taux de TVA" ` +
    `error="Saisissez un taux entre 0 et 100 (par exemple 20, 10 ou 5,5)." sqref="E${premiere}:E${derniere}"><formula1>0</formula1><formula2>100</formula2></dataValidation></dataValidations>`

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${sheetData}</sheetData>` +
    `<mergeCells count="${fusions.length}">${fusions.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>${validation}` +
    `<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`
  )
}

/* Styles : polices, fonds, bordures, formats de nombre, puis les cellXfs indexés par S. */
const FILET = "FFCBD5E1"
const bord = `<border><left style="thin"><color rgb="${FILET}"/></left><right style="thin"><color rgb="${FILET}"/></right><top style="thin"><color rgb="${FILET}"/></top><bottom style="thin"><color rgb="${FILET}"/></bottom><diagonal/></border>`

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>` +
  `<fonts count="6">` +
  `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>` + // 0 normal
  `<font><b/><sz val="20"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>` + // 1 titre
  `<font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>` + // 2 gras
  `<font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>` + // 3 champ / note
  `<font><i/><sz val="10"/><color rgb="FFB45309"/><name val="Calibri"/><family val="2"/></font>` + // 4 bandeau d'exemple
  `<font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/><family val="2"/></font>` + // 5 texte gris
  `</fonts>` +
  `<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>` + // 2 gris clair
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFEFCE8"/><bgColor indexed="64"/></patternFill></fill></fills>` + // 3 case à remplir
  `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${bord}</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="19">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` + // 0 défaut
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>` + // 1 titre
  `<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>` + // 2 section
  `<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` + // 3 champ à remplir (texte indicatif)
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` + // 4 libellé
  `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` + // 5 saisie
  `<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` + // 6 en-tête de table
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` + // 7 texte de table
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` + // 8 quantité
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` + // 9 montant
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` + // 10 taux
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` + // 11 libellé de total
  `<xf numFmtId="164" fontId="2" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` + // 12 total en gras
  `<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` + // 13 note
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` + // 14 texte long
  `<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` + // 15 bandeau
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>` + // 16 signature
  `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>` + // 17 taux à saisir
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` + // 18 unité (centrée)
  `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const CLASSEUR =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews>` +
  `<sheets><sheet name="Devis" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`

const CLASSEUR_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`

const RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`

const coreProps = (titre: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
  `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
  `<dc:title>${xml(titre)}</dc:title><dc:creator>Qonforme</dc:creator><dc:language>fr-FR</dc:language>` +
  `<dcterms:created xsi:type="dcterms:W3CDTF">${DATE_ARCHIVE.toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>`

export function construireXlsx(options: OptionsModele): Uint8Array {
  const enc = new TextEncoder()
  const fichier = (name: string, texte: string) => ({ name, data: enc.encode(texte), modified: DATE_ARCHIVE })
  return createZip(
    [
      fichier("[Content_Types].xml", CONTENT_TYPES),
      fichier("_rels/.rels", RELS),
      fichier("xl/workbook.xml", CLASSEUR),
      fichier("xl/_rels/workbook.xml.rels", CLASSEUR_RELS),
      fichier("xl/worksheets/sheet1.xml", construireFeuille(options)),
      fichier("xl/styles.xml", STYLES),
      fichier("docProps/core.xml", coreProps(options.titre)),
    ],
    { folders: true },
  )
}
