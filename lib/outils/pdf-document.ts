import fs from "fs"
import path from "path"
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { formatCentimes, formatNombreFr, versEntier } from "./decimal"
import type { DocumentOutil } from "./document"

/**
 * PDF des générateurs gratuits de facture et de devis (côté serveur).
 *
 * - Toutes les lignes sont imprimées : la table continue sur autant de pages
 *   que nécessaire, avec son en-tête répété et « Page n / N » en pied.
 * - Les textes longs (nom, adresses, désignations, mentions, notes) passent à
 *   la ligne dans leur colonne ; un mot plus large que la colonne est coupé.
 * - Totaux et ventilation de la TVA par taux viennent de calculerTotaux(),
 *   le même calcul que l'aperçu à l'écran.
 * - Polices sous-ensemblées (subset) : seuls les glyphes utilisés sont embarqués.
 */

const [W, H] = PageSizes.A4
const MARGE = 48
const BAS = MARGE + 22
const CW = W - 2 * MARGE

const ACCENT = rgb(0.145, 0.388, 0.922) // #2563EB
const ENCRE = rgb(0.06, 0.09, 0.17)
const GRIS = rgb(0.28, 0.34, 0.41)
const GRIS_CLAIR = rgb(0.45, 0.5, 0.57)
const FOND = rgb(0.96, 0.97, 0.98)
const FILET = rgb(0.85, 0.87, 0.9)
const BLANC = rgb(1, 1, 1)

/** Colonnes de la table : désignation à gauche, nombres alignés à droite. */
const COL = {
  designationX: MARGE + 6,
  designationW: 200,
  qteDroite: MARGE + 266,
  puDroite: MARGE + 348,
  tvaDroite: MARGE + 392,
  totalDroite: W - MARGE - 6,
}

const fmtDate = (iso: string) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`))
    : ""

const fmtTaux = (t: number) => `${formatNombreFr(t, 2)} %`

/** Pictogrammes, sélecteurs de variante et liants : absents de la police, retirés. */
const PICTOS = new RegExp("[\\p{Extended_Pictographic}\\u200d\\ufe0e\\ufe0f]", "gu")

export async function genererPdfDocument(d: DocumentOutil): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const dir = path.join(process.cwd(), "public", "fonts")
  const regular = await doc.embedFont(fs.readFileSync(path.join(dir, "Roboto-Regular.ttf")), { subset: true })
  const bold = await doc.embedFont(fs.readFileSync(path.join(dir, "Roboto-Bold.ttf")), { subset: true })
  const jeu = new Set(regular.getCharacterSet())

  /** Texte imprimable : retours chariot et tabulations normalisés, caractères absents de la police remplacés. */
  const propre = (s: string) =>
    Array.from(s.normalize("NFC").replace(PICTOS, "").replace(/\t/g, " "))
      .filter((c) => c === "\n" || c.codePointAt(0)! >= 0x20)
      .map((c) => (c === "\n" || jeu.has(c.codePointAt(0)!) ? c : "?"))
      .join("")

  /** Découpe un texte en lignes qui tiennent dans `largeur` ; les sauts de ligne saisis sont gardés. */
  const couper = (s: string, font: PDFFont, taille: number, largeur: number): string[] => {
    const lignes: string[] = []
    const larg = (t: string) => font.widthOfTextAtSize(t, taille)
    for (const para of propre(s).split("\n")) {
      let ligne = ""
      for (const mot of para.split(/ +/).filter(Boolean)) {
        const essai = ligne ? `${ligne} ${mot}` : mot
        if (larg(essai) <= largeur) { ligne = essai; continue }
        if (ligne) lignes.push(ligne)
        ligne = ""
        // Mot plus large que la colonne (référence, URL) : coupé caractère par caractère
        for (const c of Array.from(mot)) {
          if (ligne && larg(ligne + c) > largeur) { lignes.push(ligne); ligne = c }
          else ligne += c
        }
      }
      lignes.push(ligne)
    }
    return lignes
  }

  const titre = d.type === "facture" ? "FACTURE" : "DEVIS"
  const pages: PDFPage[] = []
  let page!: PDFPage
  let y = 0

  const ecrire = (t: string, x: number, yy: number, taille: number, font: PDFFont, color: RGB) =>
    page.drawText(t, { x, y: yy, size: taille, font, color })
  const ecrireDroite = (t: string, xDroite: number, yy: number, taille: number, font: PDFFont, color: RGB) =>
    ecrire(t, xDroite - font.widthOfTextAtSize(t, taille), yy, taille, font, color)

  const nouvellePage = () => {
    page = doc.addPage(PageSizes.A4)
    pages.push(page)
    y = H - MARGE
    if (pages.length > 1) {
      // Rappel du document en tête des pages suivantes
      const rappel = propre(`${titre}${d.numero ? ` ${d.numero}` : ""} — ${d.emetteur.nom}`)
      ecrire(couper(rappel, regular, 8, CW)[0] + " (suite)", MARGE, y - 8, 8, regular, GRIS_CLAIR)
      y -= 26
    }
  }
  /** Passe à la page suivante si `h` points ne tiennent plus ; vrai si une page a été ajoutée. */
  const place = (h: number) => {
    if (y - h >= BAS) return false
    nouvellePage()
    return true
  }

  nouvellePage()

  /* ── En-tête : émetteur à gauche, titre et références à droite ── */
  const GAUCHE_W = 280
  let yg = y
  for (const l of couper(d.emetteur.nom, bold, 15, GAUCHE_W)) { yg -= 17; ecrire(l, MARGE, yg, 15, bold, ACCENT) }
  yg -= 3
  const infosEmetteur = [
    ...(d.emetteur.adresse ? couper(d.emetteur.adresse, regular, 9, GAUCHE_W) : []),
    ...(d.emetteur.siret ? couper(`SIRET : ${d.emetteur.siret}`, regular, 9, GAUCHE_W) : []),
    ...(d.emetteur.tva ? couper(`N° TVA : ${d.emetteur.tva}`, regular, 9, GAUCHE_W) : []),
    ...(d.emetteur.email ? couper(d.emetteur.email, regular, 9, GAUCHE_W) : []),
  ]
  for (const l of infosEmetteur) { yg -= 12; ecrire(l, MARGE, yg, 9, regular, GRIS) }

  let yd = y - 20
  ecrireDroite(titre, W - MARGE, yd, 22, bold, ENCRE)
  yd -= 8
  const infos: [string, string][] = [
    ...(d.numero ? [["N°", d.numero] as [string, string]] : []),
    [d.type === "facture" ? "Date d'émission" : "Date", fmtDate(d.date)],
    ...(d.date2 ? [[d.type === "facture" ? "Échéance" : "Valable jusqu'au", fmtDate(d.date2)] as [string, string]] : []),
  ]
  for (const [label, valeur] of infos) {
    const l = `${label} : `
    const lw = regular.widthOfTextAtSize(l, 9)
    const morceaux = couper(valeur, bold, 9, 200 - lw)
    morceaux.forEach((m, i) => {
      yd -= 13
      if (i === 0) ecrireDroite(l, W - MARGE - bold.widthOfTextAtSize(m, 9), yd, 9, regular, GRIS_CLAIR)
      ecrireDroite(m, W - MARGE, yd, 9, bold, ENCRE)
    })
  }
  y = Math.min(yg, yd) - 22

  /* ── Bloc client, à droite ── */
  const BOITE_W = 250
  const boiteX = W - MARGE - BOITE_W
  const texteW = BOITE_W - 20
  const nomClient = couper(d.client.nom, bold, 10.5, texteW)
  const infosClient = [
    ...(d.client.adresse ? couper(d.client.adresse, regular, 9, texteW) : []),
    ...(d.client.siret ? couper(`SIRET : ${d.client.siret}`, regular, 9, texteW) : []),
  ]
  const boiteH = 10 + 10 + nomClient.length * 13 + infosClient.length * 12 + 8
  page.drawRectangle({ x: boiteX, y: y - boiteH, width: BOITE_W, height: boiteH, color: FOND })
  let yc = y - 16
  ecrire(d.type === "facture" ? "FACTURÉ À" : "CLIENT", boiteX + 10, yc, 7.5, bold, GRIS_CLAIR)
  for (const l of nomClient) { yc -= 13; ecrire(l, boiteX + 10, yc, 10.5, bold, ENCRE) }
  for (const l of infosClient) { yc -= 12; ecrire(l, boiteX + 10, yc, 9, regular, GRIS) }
  y -= boiteH + 24

  /* ── Table des lignes ── */
  const enteteTable = () => {
    page.drawRectangle({ x: MARGE, y: y - 20, width: CW, height: 20, color: ACCENT })
    const yy = y - 13.5
    ecrire("Désignation", COL.designationX, yy, 8, bold, BLANC)
    ecrireDroite("Qté", COL.qteDroite, yy, 8, bold, BLANC)
    ecrireDroite("Prix unit. HT", COL.puDroite, yy, 8, bold, BLANC)
    ecrireDroite("TVA", COL.tvaDroite, yy, 8, bold, BLANC)
    ecrireDroite("Total HT", COL.totalDroite, yy, 8, bold, BLANC)
    y -= 20
  }
  place(20 + 26)
  enteteTable()

  const INTERLIGNE = 11.5
  d.totaux.lignes.forEach((l, i) => {
    const texteLigne = couper(l.description, regular, 9, COL.designationW)
    const h = texteLigne.length * INTERLIGNE + 8
    if (place(h)) enteteTable()
    if (i % 2 === 1) page.drawRectangle({ x: MARGE, y: y - h, width: CW, height: h, color: FOND })
    let yy = y - 4 - 8.5
    ecrireDroite(formatNombreFr(l.quantite, 3), COL.qteDroite, yy, 9, regular, ENCRE)
    ecrireDroite(formatCentimes(versEntier(l.prixHT, 2)), COL.puDroite, yy, 9, regular, ENCRE)
    ecrireDroite(fmtTaux(l.tauxTVA), COL.tvaDroite, yy, 9, regular, ENCRE)
    ecrireDroite(formatCentimes(l.htCentimes), COL.totalDroite, yy, 9, bold, ENCRE)
    for (const t of texteLigne) { ecrire(t, COL.designationX, yy, 9, regular, ENCRE); yy -= INTERLIGNE }
    y -= h
  })
  page.drawLine({ start: { x: MARGE, y }, end: { x: W - MARGE, y }, thickness: 0.5, color: FILET })

  /* ── Totaux et ventilation de la TVA par taux ── */
  const { ventilation, htCentimes, tvaCentimes, ttcCentimes } = d.totaux
  const lignesTotaux: { label: string; valeur: string; fort?: boolean }[] = [
    { label: "Total HT", valeur: formatCentimes(htCentimes) },
    ...ventilation.map((v) => ({
      label: `TVA ${fmtTaux(v.taux)} sur ${formatCentimes(v.baseCentimes)} HT`,
      valeur: formatCentimes(v.tvaCentimes),
    })),
    ...(ventilation.length > 1 ? [{ label: "Total TVA", valeur: formatCentimes(tvaCentimes) }] : []),
    { label: "Total TTC", valeur: formatCentimes(ttcCentimes), fort: true },
  ]
  const totauxH = 22 + lignesTotaux.length * 15 + 8
  place(totauxH)
  y -= 18
  const VALEUR_DROITE = W - MARGE - 6
  const LABEL_DROITE = W - MARGE - 100
  for (const t of lignesTotaux) {
    if (t.fort) {
      page.drawLine({ start: { x: LABEL_DROITE - 150, y: y + 11 }, end: { x: W - MARGE, y: y + 11 }, thickness: 0.8, color: ENCRE })
      y -= 4
      ecrireDroite(t.label, LABEL_DROITE, y, 11, bold, ENCRE)
      ecrireDroite(t.valeur, VALEUR_DROITE, y, 11, bold, ACCENT)
    } else {
      ecrireDroite(t.label, LABEL_DROITE, y, 9, regular, GRIS)
      ecrireDroite(t.valeur, VALEUR_DROITE, y, 9, regular, ENCRE)
    }
    y -= 15
  }
  y -= 8

  /* ── Mentions, assurance, notes ── */
  const bloc = (titreBloc: string | null, contenu: string, taille = 8.5) => {
    if (!contenu) return
    const lignes = couper(contenu, regular, taille, CW)
    place((titreBloc ? 13 : 0) + Math.min(lignes.length, 3) * (taille + 3) + 8)
    y -= 8
    if (titreBloc) { y -= 10; ecrire(titreBloc, MARGE, y, 8.5, bold, GRIS) ; y -= 2 }
    for (const l of lignes) {
      if (place(taille + 3)) y -= 2
      y -= taille + 3
      ecrire(l, MARGE, y, taille, regular, GRIS)
    }
  }
  bloc(null, d.mentionTVA, 9)
  bloc(d.type === "facture" ? "Conditions de paiement" : "Conditions", d.mentions)
  bloc("Assurance professionnelle", d.assurance)
  bloc("Notes", d.notes)

  /* ── Pied de chaque page ── */
  const pied = `${d.type === "facture" ? "Facture générée" : "Devis généré"} gratuitement sur qonforme.fr`
  pages.forEach((p, i) => {
    const pw = regular.widthOfTextAtSize(pied, 8)
    p.drawText(pied, { x: (W - pw) / 2, y: 28, size: 8, font: regular, color: rgb(0.62, 0.66, 0.71) })
    if (pages.length > 1) {
      const num = `Page ${i + 1} / ${pages.length}`
      p.drawText(num, { x: W - MARGE - regular.widthOfTextAtSize(num, 8), y: 28, size: 8, font: regular, color: rgb(0.62, 0.66, 0.71) })
    }
  })

  doc.setTitle(propre(`${d.type === "facture" ? "Facture" : "Devis"}${d.numero ? ` ${d.numero}` : ""}`))
  doc.setAuthor(propre(d.emetteur.nom))
  doc.setCreator("Qonforme — outil gratuit")
  doc.setLanguage("fr-FR")
  return doc.save()
}
