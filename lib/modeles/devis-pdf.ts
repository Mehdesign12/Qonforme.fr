/**
 * Modèle de devis en PDF, à imprimer et remplir à la main (ou exemple chiffré).
 * Deux pages A4 : le devis (parties, informations, prestations, totaux), puis
 * les mentions à garder selon la situation et le cadre de signature. Polices
 * Roboto sous-ensemblées, comme les autres PDF du site ; mise en page dessinée
 * avec pdf-lib, sans dépendance de plus.
 */
import fs from "fs"
import path from "path"
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { formatCentimes, formatNombreFr, versEntier } from "@/lib/outils/decimal"
import { calculerTotaux, totalLigneCentimes } from "@/lib/outils/document"
import {
  BANDEAU_EXEMPLE, CLIENT, COLONNES, CONDITIONS_TEXTE, CONDITIONS_TITRE, DATE_ARCHIVE, ENTREPRISE, INFOS, LIBELLE_ACOMPTE,
  LIBELLE_RESTE, LIBELLE_TOTAL_HT, LIBELLE_TTC, MENTIONS, MENTIONS_TITRE, NB_LIGNES, OBJET_LIBELLE, PIED, SIGNATURE,
  type LigneModele, type OptionsModele,
} from "./devis"

const [W, H] = PageSizes.A4
const M = 40
const CW = W - 2 * M

const ENCRE = rgb(0.06, 0.09, 0.17)
const GRIS = rgb(0.39, 0.45, 0.55)
const FILET = rgb(0.8, 0.84, 0.88)
const FOND = rgb(0.945, 0.96, 0.975)
const AMBRE = rgb(0.71, 0.33, 0.04)

/** Colonnes de la table (largeurs en points, somme = CW). */
const COLS = [196, 42, 48, 84, 52, 53]

export async function construirePdf(options: OptionsModele): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const dir = path.join(process.cwd(), "public", "fonts")
  const regular = await doc.embedFont(fs.readFileSync(path.join(dir, "Roboto-Regular.ttf")), { subset: true })
  const bold = await doc.embedFont(fs.readFileSync(path.join(dir, "Roboto-Bold.ttf")), { subset: true })
  doc.setTitle(options.titre)
  doc.setAuthor("Qonforme")
  doc.setCreator("Qonforme")
  doc.setProducer("Qonforme")
  doc.setLanguage("fr-FR")
  doc.setCreationDate(DATE_ARCHIVE)
  doc.setModificationDate(DATE_ARCHIVE)

  const jeu = new Set(regular.getCharacterSet())
  const propre = (s: string) =>
    Array.from(s.normalize("NFC"))
      .map((c) => (c === "\n" || jeu.has(c.codePointAt(0)!) ? c : "?"))
      .join("")

  const couper = (s: string, font: PDFFont, taille: number, largeur: number): string[] => {
    const lignes: string[] = []
    for (const para of propre(s).split("\n")) {
      let ligne = ""
      for (const mot of para.split(/ +/).filter(Boolean)) {
        const essai = ligne ? `${ligne} ${mot}` : mot
        if (font.widthOfTextAtSize(essai, taille) <= largeur) ligne = essai
        else {
          if (ligne) lignes.push(ligne)
          ligne = mot
        }
      }
      lignes.push(ligne)
    }
    return lignes
  }

  const pages: PDFPage[] = []
  const nouvellePage = () => {
    const p = doc.addPage([W, H])
    pages.push(p)
    return p
  }

  /** Texte à partir du haut de la page (y vers le bas), renvoie le y suivant. */
  const texte = (p: PDFPage, s: string, x: number, haut: number, o: { font?: PDFFont; taille?: number; couleur?: ReturnType<typeof rgb>; largeur?: number; interligne?: number; droite?: number } = {}) => {
    const font = o.font ?? regular
    const taille = o.taille ?? 9.5
    const interligne = o.interligne ?? taille * 1.35
    const lignes = o.largeur ? couper(s, font, taille, o.largeur) : propre(s).split("\n")
    lignes.forEach((l, i) => {
      const dx = o.droite !== undefined ? o.droite - font.widthOfTextAtSize(l, taille) : x
      p.drawText(l, { x: dx, y: H - haut - taille - i * interligne, size: taille, font, color: o.couleur ?? ENCRE })
    })
    return haut + lignes.length * interligne
  }

  const cadre = (p: PDFPage, x: number, haut: number, w: number, h: number, fond?: ReturnType<typeof rgb>) =>
    p.drawRectangle({ x, y: H - haut - h, width: w, height: h, borderColor: FILET, borderWidth: 0.8, color: fond })

  /* ───────────── Page 1 ───────────── */
  const p1 = nouvellePage()
  let y = M
  texte(p1, options.titre, M, y, { font: bold, taille: 26 })
  y += 36
  if (options.exempleFictif) y = texte(p1, BANDEAU_EXEMPLE, M, y, { taille: 8.5, couleur: AMBRE, largeur: CW }) + 6

  // Entreprise | client
  const moitie = (CW - 12) / 2
  const hBloc = 20 + ENTREPRISE.length * 15
  ;[
    { x: M, titre: "VOTRE ENTREPRISE", lignes: ENTREPRISE },
    { x: M + moitie + 12, titre: "CLIENT", lignes: CLIENT },
  ].forEach(({ x, titre, lignes }) => {
    cadre(p1, x, y, moitie, hBloc)
    texte(p1, titre, x + 8, y + 7, { font: bold, taille: 8, couleur: GRIS })
    lignes.forEach((l, i) => texte(p1, l, x + 8, y + 22 + i * 15, { taille: 8.5, couleur: GRIS, largeur: moitie - 16 }))
  })
  y += hBloc + 10

  // Informations : libellé et trait à compléter, deux par ligne
  for (const [a, b] of INFOS) {
    ;[
      [M, a],
      [M + moitie + 12, b],
    ].forEach(([x, libelle]) => {
      const xx = x as number
      texte(p1, `${libelle} :`, xx, y, { font: bold, taille: 8.5, largeur: moitie })
      p1.drawLine({ start: { x: xx, y: H - y - 22 }, end: { x: xx + moitie, y: H - y - 22 }, thickness: 0.6, color: FILET })
    })
    y += 28
  }
  y += 2

  // Objet
  texte(p1, OBJET_LIBELLE, M, y, { font: bold, taille: 9 })
  y += 14
  const hObjet = 40
  cadre(p1, M, y, CW, hObjet)
  texte(p1, options.objet ?? "[Nature des travaux et adresse du chantier]", M + 8, y + 7, { taille: 9, largeur: CW - 16, couleur: options.objet ? ENCRE : GRIS })
  y += hObjet + 12

  // Table des prestations
  const xs = COLS.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? M : acc[i - 1] + COLS[i - 1]], [])
  const HEAD = 20
  p1.drawRectangle({ x: M, y: H - y - HEAD, width: CW, height: HEAD, color: FOND, borderColor: FILET, borderWidth: 0.8 })
  COLONNES.forEach((nom, i) => {
    if (i === 0) texte(p1, nom, xs[i] + 6, y + 6, { font: bold, taille: 8.5 })
    else texte(p1, nom, 0, y + 6, { font: bold, taille: 8.5, droite: xs[i] + COLS[i] - 5 })
  })
  y += HEAD

  const donnees: LigneModele[] = options.lignes ?? []
  const valeurs = (l: LigneModele) => [
    l.designation ?? "",
    l.quantite !== undefined ? formatNombreFr(l.quantite) : "",
    l.unite ?? "",
    l.prixHT !== undefined ? formatCentimes(versEntier(l.prixHT, 2)) : "",
    l.tva !== undefined ? formatNombreFr(l.tva) : "",
    l.quantite !== undefined && l.prixHT !== undefined ? formatCentimes(totalLigneCentimes(l.quantite, l.prixHT)) : "",
  ]
  const HAUTEUR_LIGNE = 19
  const BAS_TABLE = H - 250 // laisse la place aux totaux et aux conditions
  const rangees: { l: LigneModele; h: number; lignesTexte: string[] }[] = []
  let cumul = y
  const ajouter = (l: LigneModele) => {
    const lt = couper(l.designation ?? "", regular, 8.5, COLS[0] - 12)
    const h = Math.max(HAUTEUR_LIGNE, lt.length * 11.5 + 8)
    if (cumul + h > BAS_TABLE) return false
    rangees.push({ l, h, lignesTexte: lt })
    cumul += h
    return true
  }
  for (const l of donnees) if (!ajouter(l)) break
  for (let i = rangees.length; i < NB_LIGNES; i++) if (!ajouter({})) break

  for (const { l, h, lignesTexte } of rangees) {
    p1.drawRectangle({ x: M, y: H - y - h, width: CW, height: h, borderColor: FILET, borderWidth: 0.8 })
    xs.slice(1).forEach((x) => p1.drawLine({ start: { x, y: H - y }, end: { x, y: H - y - h }, thickness: 0.6, color: FILET }))
    const v = valeurs(l)
    lignesTexte.forEach((t, i) => texte(p1, t, xs[0] + 6, y + 5 + i * 11.5, { taille: 8.5 }))
    v.slice(1).forEach((s, i) => s && texte(p1, s, 0, y + 5, { taille: 8.5, droite: xs[i + 1] + COLS[i + 1] - 5 }))
    y += h
  }
  y += 12

  // Conditions (à gauche) et totaux (à droite)
  const rempli = donnees.filter((l) => l.quantite !== undefined && l.prixHT !== undefined)
  const t = rempli.length
    ? calculerTotaux(rempli.map((l) => ({ description: l.designation ?? "", quantite: l.quantite ?? 0, prixHT: l.prixHT ?? 0, tauxTVA: l.tva ?? 20 })))
    : null
  const lignesTotaux: [string, string, boolean][] = [[LIBELLE_TOTAL_HT, t ? formatCentimes(t.htCentimes) : "", false]]
  if (t) for (const v of t.ventilation) lignesTotaux.push([`TVA ${formatNombreFr(v.taux)} % sur ${formatCentimes(v.baseCentimes)}`, formatCentimes(v.tvaCentimes), false])
  else lignesTotaux.push(["TVA (par taux : 20 %, 10 %, 5,5 %…)", "", false])
  lignesTotaux.push([LIBELLE_TTC, t ? formatCentimes(t.ttcCentimes) : "", true], [LIBELLE_ACOMPTE, "", false], [LIBELLE_RESTE, "", false])

  const largeurTotaux = 236
  const xT = W - M - largeurTotaux
  const hT = 19
  lignesTotaux.forEach(([libelle, valeur, fort], i) => {
    const top = y + i * hT
    p1.drawRectangle({ x: xT, y: H - top - hT, width: largeurTotaux, height: hT, borderColor: FILET, borderWidth: 0.8, color: fort ? FOND : undefined })
    texte(p1, libelle, xT + 6, top + 5, { font: fort ? bold : regular, taille: 8.5, largeur: largeurTotaux - 80 })
    if (valeur) texte(p1, valeur, 0, top + 5, { font: fort ? bold : regular, taille: 8.5, droite: xT + largeurTotaux - 6 })
  })
  const largeurGauche = CW - largeurTotaux - 16
  texte(p1, CONDITIONS_TITRE, M, y, { font: bold, taille: 9 })
  if (options.conditions?.length) {
    let yc = y + 14
    for (const c of options.conditions) yc = texte(p1, `•  ${c}`, M, yc, { taille: 8, largeur: largeurGauche, interligne: 10.5 }) + 2
  } else {
    texte(p1, CONDITIONS_TEXTE, M, y + 14, { taille: 8.5, couleur: GRIS, largeur: largeurGauche })
  }

  /* ───────────── Page 2 : mentions et signature ───────────── */
  const p2 = nouvellePage()
  let y2 = M
  y2 = texte(p2, MENTIONS_TITRE, M, y2, { font: bold, taille: 11 }) + 8
  for (const m of [...MENTIONS, ...(options.mentionsMetier ?? [])]) {
    p2.drawRectangle({ x: M, y: H - y2 - 10, width: 9, height: 9, borderColor: GRIS, borderWidth: 0.8 })
    y2 = texte(p2, m, M + 18, y2, { taille: 9, largeur: CW - 18 }) + 8
  }
  y2 += 10
  texte(p2, SIGNATURE, M, y2, { font: bold, taille: 9.5 })
  y2 += 16
  cadre(p2, M, y2, CW, 90)

  // Pied de page
  pages.forEach((p, i) => {
    texte(p, PIED, M, H - 30, { taille: 7, couleur: GRIS, largeur: CW - 60, interligne: 9 })
    texte(p, `Page ${i + 1} / ${pages.length}`, 0, H - 30, { taille: 7.5, couleur: GRIS, droite: W - M })
  })

  return doc.save()
}
