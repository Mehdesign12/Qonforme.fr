/**
 * Modèle de devis au format Word (.docx), écrit à la main en WordprocessingML :
 * une archive ZIP de quatre fichiers XML, sans dépendance. Mise en page A4 en
 * un seul tenant : tableaux à bordures fines, champs à remplir entre crochets
 * en gris, lignes de prestations vides (ou celles d'un exemple).
 *
 * Norme : ECMA-376 / ISO 29500, parties 1 (WordprocessingML) et 2 (OPC).
 * Validé à l'ouverture et à la conversion par LibreOffice (voir le test).
 */
import { createZip } from "@/lib/accountant/zip"
import { formatCentimes, formatNombreFr, versEntier } from "@/lib/outils/decimal"
import { calculerTotaux, totalLigneCentimes } from "@/lib/outils/document"
import {
  BANDEAU_EXEMPLE, CLIENT, COLONNES, CONDITIONS_TEXTE, CONDITIONS_TITRE, DATE_ARCHIVE, ENTREPRISE, INFOS, LIBELLE_ACOMPTE,
  LIBELLE_RESTE, LIBELLE_TOTAL_HT, LIBELLE_TTC, MENTIONS, MENTIONS_TITRE, OBJET_LIBELLE, PIED, SIGNATURE,
  lignesAffichees, type OptionsModele,
} from "./devis"

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

/** Largeur utile de la page A4 : 11 906 − 2 × 1 000 twips (1 twip = 1/20 de point). */
const LARGEUR = 9906
/** Désignation, quantité, unité, prix unitaire, TVA, total. */
const COLS = [3900, 750, 850, 1650, 950, 1806]
/** Moitié de la largeur, pour les deux blocs côte à côte. */
const MOITIE = LARGEUR / 2

const FILET = "CBD5E1"
const FOND = "F1F5F9"
const GRIS = "64748B"
const ENCRE = "0F172A"

/** Texte XML : seuls & < > sont à échapper dans un élément. */
export function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

interface Style {
  gras?: boolean
  italique?: boolean
  couleur?: string
  /** Taille en demi-points (20 = 10 pt). */
  taille?: number
}

const run = (texte: string, s: Style = {}) =>
  `<w:r><w:rPr>${s.gras ? "<w:b/>" : ""}${s.italique ? "<w:i/>" : ""}${s.couleur ? `<w:color w:val="${s.couleur}"/>` : ""}` +
  `${s.taille ? `<w:sz w:val="${s.taille}"/><w:szCs w:val="${s.taille}"/>` : ""}</w:rPr><w:t xml:space="preserve">${xml(texte)}</w:t></w:r>`

interface Para {
  align?: "left" | "right" | "center"
  avant?: number
  apres?: number
  /** Reste sur la même page que le paragraphe suivant (un titre ne finit jamais seul en bas de page). */
  suivant?: boolean
}

const para = (runs: string, p: Para = {}) =>
  `<w:p><w:pPr>${p.suivant ? "<w:keepNext/>" : ""}<w:spacing w:before="${p.avant ?? 0}" w:after="${p.apres ?? 0}"/>${p.align ? `<w:jc w:val="${p.align}"/>` : ""}</w:pPr>${runs}</w:p>`

interface Cellule {
  largeur: number
  contenu: string
  fond?: string
  /** Fusion de colonnes. */
  span?: number
  verticalCentre?: boolean
  /** Case sans cadre (cellule vide qui sert à décaler un tableau vers la droite). */
  sansBordure?: boolean
}

const cellule = (c: Cellule) =>
  `<w:tc><w:tcPr><w:tcW w:w="${c.largeur}" w:type="dxa"/>${c.span ? `<w:gridSpan w:val="${c.span}"/>` : ""}` +
  `${c.sansBordure ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/></w:tcBorders>' : ""}${c.fond ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.fond}"/>` : ""}${c.verticalCentre ? '<w:vAlign w:val="center"/>' : ""}</w:tcPr>${c.contenu}</w:tc>`

const rang = (cellules: string[], { hauteur, entete }: { hauteur?: number; entete?: boolean } = {}) =>
  `<w:tr><w:trPr><w:cantSplit/>${hauteur ? `<w:trHeight w:val="${hauteur}" w:hRule="atLeast"/>` : ""}${entete ? "<w:tblHeader/>" : ""}</w:trPr>${cellules.join("")}</w:tr>`

const bordures = (c: string) =>
  ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${c}"/>`).join("")

const tableau = (largeurs: number[], rangs: string[]) =>
  `<w:tbl><w:tblPr><w:tblW w:w="${largeurs.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${bordures(FILET)}</w:tblBorders>` +
  `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
  `<w:tblGrid>${largeurs.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rangs.join("")}</w:tbl>`

const titreSection = (texte: string) => para(run(texte, { gras: true, taille: 20, couleur: ENCRE }), { avant: 220, apres: 60, suivant: true })

const champ = (texte: string) => para(run(texte, { couleur: GRIS, taille: 19 }), { apres: 20 })

/** Prix en euros → texte français (« 1 250,00 € »), sans passer par un calcul flottant. */
const euros = (n: number) => formatCentimes(versEntier(n, 2))

function blocParties(): string {
  const bloc = (titre: string, lignes: string[]) =>
    cellule({
      largeur: MOITIE,
      contenu: para(run(titre, { gras: true, taille: 18, couleur: GRIS }), { apres: 40 }) + lignes.map(champ).join(""),
    })
  return tableau([MOITIE, MOITIE], [rang([bloc("VOTRE ENTREPRISE", ENTREPRISE), bloc("CLIENT", CLIENT)])])
}

function blocInfos(): string {
  const cell = (libelle: string) =>
    cellule({
      largeur: MOITIE,
      contenu: para(run(`${libelle} : `, { gras: true, taille: 19 }) + run("[à compléter]", { couleur: GRIS, taille: 19 })),
    })
  return tableau([MOITIE, MOITIE], INFOS.map(([a, b]) => rang([cell(a), cell(b)], { hauteur: 380 })))
}

function tableLignes(options: OptionsModele): string {
  const entete = rang(
    COLONNES.map((nom, i) =>
      cellule({
        largeur: COLS[i],
        fond: FOND,
        verticalCentre: true,
        contenu: para(run(nom, { gras: true, taille: 18, couleur: ENCRE }), { align: i === 0 ? "left" : "right" }),
      }),
    ),
    { entete: true, hauteur: 340 },
  )
  const lignes = lignesAffichees(options).map((l) => {
    const total = l.quantite !== undefined && l.prixHT !== undefined ? formatCentimes(totalLigneCentimes(l.quantite, l.prixHT)) : ""
    const valeurs = [
      l.designation ?? "",
      l.quantite !== undefined ? formatNombreFr(l.quantite) : "",
      l.unite ?? "",
      l.prixHT !== undefined ? euros(l.prixHT) : "",
      l.tva !== undefined ? formatNombreFr(l.tva) : "",
      total,
    ]
    return rang(
      valeurs.map((v, i) => cellule({ largeur: COLS[i], contenu: para(run(v, { taille: 19 }), { align: i === 0 ? "left" : "right" }) })),
      { hauteur: 400 },
    )
  })
  return tableau(COLS, [entete, ...lignes])
}

/** Totaux : calculés, pour un exemple ; en pointillés, pour le modèle vierge. */
function blocTotaux(options: OptionsModele): string {
  const rempli = (options.lignes ?? []).filter((l) => l.quantite !== undefined && l.prixHT !== undefined)
  const t = rempli.length
    ? calculerTotaux(rempli.map((l) => ({ description: l.designation ?? "", quantite: l.quantite ?? 0, prixHT: l.prixHT ?? 0, tauxTVA: l.tva ?? 20 })))
    : null

  const lignes: [string, string, boolean][] = [[LIBELLE_TOTAL_HT, t ? formatCentimes(t.htCentimes) : "", false]]
  if (t) for (const v of t.ventilation) lignes.push([`TVA ${formatNombreFr(v.taux)} % sur ${formatCentimes(v.baseCentimes)}`, formatCentimes(v.tvaCentimes), false])
  else lignes.push(["TVA (par taux : 20 %, 10 %, 5,5 %…)", "", false])
  lignes.push([LIBELLE_TTC, t ? formatCentimes(t.ttcCentimes) : "", true])
  lignes.push([LIBELLE_ACOMPTE, "", false], [LIBELLE_RESTE, "", false])

  const l1 = 3400
  const l2 = 1900
  const gauche = LARGEUR - l1 - l2
  const rangs = lignes.map(([libelle, valeur, fort]) =>
    rang(
      [
        cellule({ largeur: gauche, contenu: para(""), sansBordure: true }),
        cellule({ largeur: l1, fond: fort ? FOND : undefined, contenu: para(run(libelle, { gras: fort, taille: 19 })) }),
        cellule({ largeur: l2, fond: fort ? FOND : undefined, contenu: para(run(valeur, { gras: fort, taille: 19 }), { align: "right" }) }),
      ],
      { hauteur: 340 },
    ),
  )
  return tableau([gauche, l1, l2], rangs)
}

function corps(options: OptionsModele): string {
  const mentions = [...MENTIONS, ...(options.mentionsMetier ?? [])]
  const parts: string[] = []
  parts.push(para(run(options.titre, { gras: true, taille: 40, couleur: ENCRE }), { apres: 60 }))
  if (options.exempleFictif) parts.push(para(run(BANDEAU_EXEMPLE, { italique: true, taille: 18, couleur: "B45309" }), { apres: 120 }))
  parts.push(blocParties(), para("", { apres: 100 }), blocInfos())
  parts.push(titreSection(OBJET_LIBELLE))
  parts.push(para(run(options.objet ?? "[Nature des travaux et adresse du chantier]", { taille: 19, couleur: options.objet ? undefined : GRIS })))
  parts.push(titreSection("Détail des travaux : fournitures, main-d'œuvre, déplacement, évacuation des déchets"))
  parts.push(tableLignes(options), para("", { apres: 100 }), blocTotaux(options))
  parts.push(titreSection(CONDITIONS_TITRE))
  if (options.conditions?.length) for (const c of options.conditions) parts.push(para(run(`•  ${c}`, { taille: 19 }), { apres: 40 }))
  else parts.push(para(run(CONDITIONS_TEXTE, { taille: 19, couleur: GRIS })))
  parts.push(titreSection(MENTIONS_TITRE))
  for (const m of mentions) parts.push(para(run(`•  ${m}`, { taille: 18, couleur: GRIS }), { apres: 40 }))
  parts.push(titreSection(SIGNATURE))
  parts.push(tableau([LARGEUR], [rang([cellule({ largeur: LARGEUR, contenu: para("") })], { hauteur: 1100 })]))
  parts.push(para(run(PIED, { taille: 16, couleur: GRIS }), { avant: 160 }))
  return parts.join("")
}

const DOCUMENT = (options: OptionsModele) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${corps(options)}` +
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="1000" w:bottom="900" w:left="1000" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>`

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr>` +
  `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="fr-FR" w:eastAsia="fr-FR" w:bidi="ar-SA"/>` +
  `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`

const RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`

const DOCUMENT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

const coreProps = (titre: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
  `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
  `<dc:title>${xml(titre)}</dc:title><dc:creator>Qonforme</dc:creator><dc:language>fr-FR</dc:language>` +
  `<dcterms:created xsi:type="dcterms:W3CDTF">${DATE_ARCHIVE.toISOString().replace(/\.\d+Z$/, "Z")}</dcterms:created></cp:coreProperties>`

export function construireDocx(options: OptionsModele): Uint8Array {
  const enc = new TextEncoder()
  const fichier = (name: string, texte: string) => ({ name, data: enc.encode(texte), modified: DATE_ARCHIVE })
  return createZip(
    [
      fichier("[Content_Types].xml", CONTENT_TYPES),
      fichier("_rels/.rels", RELS),
      fichier("word/document.xml", DOCUMENT(options)),
      fichier("word/_rels/document.xml.rels", DOCUMENT_RELS),
      fichier("word/styles.xml", STYLES),
      fichier("docProps/core.xml", coreProps(options.titre)),
    ],
    { folders: true },
  )
}
