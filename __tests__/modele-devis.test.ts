/**
 * Modèle de devis téléchargeable (Word, Excel, PDF) : structure des archives
 * Office relue entrée par entrée, XML bien formé, formules et fusions de la
 * feuille Excel, PDF à deux pages, registre et route. Sortie facultative des
 * fichiers (variable MODELES_SORTIE) pour les ouvrir dans un vrai logiciel.
 */
import fs from "fs"
import path from "path"
import { inflateRawSync } from "node:zlib"
import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"
import { createZip, crc32 } from "@/lib/accountant/zip"
import { construireDocx } from "@/lib/modeles/devis-docx"
import { construireXlsx } from "@/lib/modeles/devis-xlsx"
import { construirePdf } from "@/lib/modeles/devis-pdf"
import { MODELE_VIERGE, NB_LIGNES, type OptionsModele } from "@/lib/modeles/devis"
import { MODELES_TELECHARGEABLES, analyserNomFichier, genererFichierModele } from "@/lib/modeles/fichier"
import { GET } from "@/app/api/outils/modeles/[fichier]/route"
import { MODELES } from "@/lib/pseo/modeles"
import { totauxExemple } from "@/lib/pseo/exemple-devis"

/** Lit une archive : noms, CRC et contenus vérifiés. */
function lireZip(zip: Uint8Array): Map<string, string> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const eocd = zip.length - 22
  expect(v.getUint32(eocd, true)).toBe(0x06054b50)
  const n = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const out = new Map<string, string>()
  for (let i = 0; i < n; i++) {
    const method = v.getUint16(p + 10, true)
    const crc = v.getUint32(p + 16, true)
    const csize = v.getUint32(p + 20, true)
    const nlen = v.getUint16(p + 28, true)
    const local = v.getUint32(p + 42, true)
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nlen))
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const raw = zip.subarray(start, start + csize)
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw
    expect(crc32(data)).toBe(crc)
    out.set(name, new TextDecoder().decode(data))
    p += 46 + nlen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
  }
  return out
}

/** XML bien formé : balises appariées, déclaration en tête, aucun « & » ou « < » nu dans le texte. */
function verifierXml(nom: string, texte: string) {
  expect(texte.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), `${nom} : déclaration`).toBe(true)
  const pile: string[] = []
  const re = /<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)>|<\?[^?]*\?>/g
  let m: RegExpExecArray | null
  let dernier = 0
  while ((m = re.exec(texte))) {
    const entre = texte.slice(dernier, m.index)
    expect(/&(?!(amp|lt|gt|quot|apos);)/.test(entre), `${nom} : « & » nu`).toBe(false)
    dernier = re.lastIndex
    if (m[0].startsWith("<?")) continue
    if (m[1]) expect(pile.pop(), `${nom} : balise fermante </${m[2]}>`).toBe(m[2])
    else if (!m[4]) pile.push(m[2])
  }
  expect(pile, `${nom} : balises ouvertes`).toEqual([])
}

const EXEMPLE: OptionsModele = {
  nom: "exemple-test",
  titre: "DEVIS",
  exempleFictif: true,
  objet: "Remplacement du tableau électrique et pose de prises",
  lignes: [
    { designation: "Tableau électrique 3 rangées, fourniture et pose", quantite: 1, unite: "u", prixHT: 480, tva: 10 },
    { designation: "Prise 16 A en saillie", quantite: 6, unite: "u", prixHT: 42.5, tva: 10 },
    { designation: "Évacuation des déchets", quantite: 1, unite: "forfait", prixHT: 60, tva: 20 },
  ],
}

describe("archive ZIP avec dossiers", () => {
  it("garde les chemins et le point initial de « _rels/.rels »", () => {
    const e = new TextEncoder()
    const zip = createZip([{ name: "_rels/.rels", data: e.encode("a") }, { name: "word/document.xml", data: e.encode("b") }], { folders: true })
    expect(Array.from(lireZip(zip).keys())).toEqual(["_rels/.rels", "word/document.xml"])
  })

  it("refuse les chemins dangereux et les doublons", () => {
    const d = new Uint8Array([1])
    for (const name of ["../x", "/x", "a/../b", "a\\b", "a//b", "", "a\u0000b"]) expect(() => createZip([{ name, data: d }], { folders: true }), name).toThrow()
    expect(() => createZip([{ name: "a.xml", data: d }, { name: "A.xml", data: d }], { folders: true })).toThrow()
  })

  it("sans l'option, comportement d'avant : un dossier devient un tiret", () => {
    const zip = createZip([{ name: "a/b.pdf", data: new Uint8Array([1]) }])
    expect(Array.from(lireZip(zip).keys())).toEqual(["a-b.pdf"])
  })
})

describe("Word (.docx)", () => {
  const fichiers = lireZip(construireDocx(MODELE_VIERGE))

  it("contient les parties exigées par le format, toutes bien formées", () => {
    expect(Array.from(fichiers.keys()).sort()).toEqual(
      ["[Content_Types].xml", "_rels/.rels", "docProps/core.xml", "word/_rels/document.xml.rels", "word/document.xml", "word/styles.xml"].sort(),
    )
    fichiers.forEach((texte, nom) => verifierXml(nom, texte))
  })

  it("liste les mentions du devis, les lignes vides et la signature", () => {
    const doc = fichiers.get("word/document.xml")!
    for (const motif of [
      "DEVIS", "VOTRE ENTREPRISE", "CLIENT", "N° du devis", "Valable jusqu&apos;au".replace("&apos;", "'"), "Assurance professionnelle (décennale",
      "Gestion des déchets du chantier", "certifie que les travaux réalisés concernent des locaux à usage d'habitation achevés depuis plus de deux ans", "TVA non applicable, art. 293 B du CGI",
      "Autoliquidation — art. 283-2 nonies du CGI", "Bon pour accord", "acompte",
    ]) expect(doc.toLowerCase(), motif).toContain(motif.toLowerCase())
    // en-tête + 12 lignes dans la table des prestations
    expect((doc.match(/<w:tblHeader\/>/g) ?? []).length).toBe(1)
    expect((doc.match(/<w:trHeight w:val="400"/g) ?? []).length).toBe(NB_LIGNES)
  })

  it("est identique d'un appel à l'autre (date fixe, aucune donnée variable)", () => {
    expect(Buffer.from(construireDocx(MODELE_VIERGE)).equals(Buffer.from(construireDocx(MODELE_VIERGE)))).toBe(true)
  })

  it("exemple : totaux calculés en centimes, TVA ventilée par taux", () => {
    const doc = lireZip(construireDocx(EXEMPLE)).get("word/document.xml")!
    // 480 + 6 × 42,50 = 735 € à 10 %, 60 € à 20 % : TVA 73,50 et 12,00, TTC 880,50
    for (const v of ["795,00", "735,00", "73,50", "12,00", "880,50", "255,00"]) expect(doc.replace(/ | /g, " "), v).toContain(v)
    expect(doc).toContain("Exemple fictif")
  })

  it("échappe le texte : aucun balisage injecté par une désignation", () => {
    const doc = lireZip(construireDocx({ ...EXEMPLE, lignes: [{ designation: "A <b>&</b> B", quantite: 1, prixHT: 1, tva: 20 }] })).get("word/document.xml")!
    verifierXml("document", doc)
    expect(doc).toContain("A &lt;b&gt;&amp;&lt;/b&gt; B")
  })
})

describe("Excel (.xlsx)", () => {
  const fichiers = lireZip(construireXlsx(MODELE_VIERGE))
  const feuille = fichiers.get("xl/worksheets/sheet1.xml")!

  it("contient les parties exigées par le format, toutes bien formées", () => {
    expect(Array.from(fichiers.keys()).sort()).toEqual(
      ["[Content_Types].xml", "_rels/.rels", "docProps/core.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"].sort(),
    )
    fichiers.forEach((texte, nom) => verifierXml(nom, texte))
    expect(fichiers.get("xl/workbook.xml")).toContain('fullCalcOnLoad="1"')
  })

  it("formules : total de ligne, TVA par taux, TTC, acompte, reste", () => {
    const formules = Array.from(feuille.matchAll(/<c r="([A-Z]+\d+)"[^>]*><f>([^<]*)<\/f>/g)).map((m) => [m[1], m[2].replace(/&quot;/g, '"')])
    const lignes = formules.filter(([ref]) => /^F\d+$/.test(ref))
    expect(lignes.length).toBe(NB_LIGNES + 1 + 3 + 1 + 1 + 1 + 1) // lignes, HT, 3 taux, autre taux, TTC, acompte, reste
    const [, a, b] = /sqref="E(\d+):E(\d+)"/.exec(feuille)!
    expect(Number(b) - Number(a) + 1).toBe(NB_LIGNES)
    expect(formules[0][1]).toBe(`IF(OR(B${a}="",D${a}=""),"",ROUND(B${a}*D${a},2))`)
    expect(feuille).toContain(`SUM(F${a}:F${b})`)
    for (const taux of [20, 10, 5.5]) expect(feuille).toContain(`ROUND(SUMIF($E$${a}:$E$${b},${taux},$F$${a}:$F$${b})*${taux}/100,2)`)
  })

  it("cases en ordre croissant dans chaque ligne, fusions sans chevauchement", () => {
    const colonne = (ref: string) => ref.charCodeAt(0) - 65
    for (const ligne of Array.from(feuille.matchAll(/<row r="(\d+)"[^>]*>(.*?)<\/row>/g))) {
      const cols = Array.from(ligne[2].matchAll(/<c r="([A-Z])(\d+)"/g)).map((m) => {
        expect(m[2]).toBe(ligne[1])
        return colonne(m[1])
      })
      expect(cols, `ligne ${ligne[1]}`).toEqual(cols.slice().sort((a, b) => a - b))
      expect(new Set(cols).size).toBe(cols.length)
    }
    const occupe = new Set<string>()
    for (const m of Array.from(feuille.matchAll(/<mergeCell ref="([A-Z])(\d+):([A-Z])(\d+)"\/>/g))) {
      for (let c = colonne(m[1]); c <= colonne(m[3]); c++) for (let r = Number(m[2]); r <= Number(m[4]); r++) {
        expect(occupe.has(`${c}:${r}`), `fusion ${m[0]}`).toBe(false)
        occupe.add(`${c}:${r}`)
      }
    }
    expect(feuille).toMatch(/<mergeCells count="(\d+)">/)
    expect(Number(/<mergeCells count="(\d+)">/.exec(feuille)![1])).toBe((feuille.match(/<mergeCell /g) ?? []).length)
  })

  it("chaque style utilisé par une case est défini dans la feuille de styles", () => {
    const definis = Number(/<cellXfs count="(\d+)">/.exec(fichiers.get("xl/styles.xml")!)![1])
    expect((fichiers.get("xl/styles.xml")!.match(/<xf [^>]*xfId="0"/g) ?? []).length).toBe(definis)
    const utilises = Array.from(feuille.matchAll(/ s="(\d+)"/g)).map((m) => Number(m[1]))
    expect(Math.max(...utilises)).toBeLessThan(definis)
  })

  it("taux de TVA saisis entre 0 et 100 seulement", () => {
    expect(feuille).toContain('<dataValidation type="decimal" operator="between"')
    expect(feuille).toMatch(/sqref="E\d+:E\d+"/)
  })

  it("exemple : quantités et prix en nombres, pas en texte", () => {
    const f = lireZip(construireXlsx(EXEMPLE)).get("xl/worksheets/sheet1.xml")!
    expect(f).toMatch(/<c r="D\d+" s="9"><v>42.5<\/v><\/c>/)
    expect(f).toMatch(/<c r="E\d+" s="10"><v>10<\/v><\/c>/)
  })
})

describe("PDF", () => {
  it("deux pages A4, titre et métadonnées", async () => {
    const pdf = await PDFDocument.load(await construirePdf(MODELE_VIERGE))
    expect(pdf.getPageCount()).toBe(2)
    expect(pdf.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 })
    expect(pdf.getTitle()).toBe("DEVIS")
  })

  it("l'exemple tient aussi sur deux pages", async () => {
    expect((await PDFDocument.load(await construirePdf(EXEMPLE))).getPageCount()).toBe(2)
  })

  it("octet pour octet identique d'un appel à l'autre", async () => {
    const a = await construirePdf(MODELE_VIERGE)
    const b = await construirePdf(MODELE_VIERGE)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

describe("registre et route", () => {
  it("reconnaît les noms de fichier et rien d'autre", () => {
    expect(analyserNomFichier("modele-devis-artisan.docx")?.format).toBe("docx")
    expect(analyserNomFichier("modele-devis-artisan.xlsx")?.format).toBe("xlsx")
    expect(analyserNomFichier("modele-devis-artisan.pdf")?.format).toBe("pdf")
    for (const nom of ["modele-devis-artisan", "modele-devis-artisan.exe", "inconnu.pdf", "constructor.pdf", "__proto__.pdf", "toString.docx", ".pdf", "../x.pdf", ""])
      expect(analyserNomFichier(nom), nom).toBeNull()
    expect(Object.keys(MODELES_TELECHARGEABLES)).toContain("modele-devis-artisan")
  })

  it("répond avec le bon type, un nom de fichier et un cache de réseau", async () => {
    for (const [ext, type] of [
      ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["pdf", "application/pdf"],
    ]) {
      const res = await GET(new Request("http://x"), { params: { fichier: `modele-devis-artisan.${ext}` } })
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toBe(type)
      expect(res.headers.get("content-disposition")).toBe(`attachment; filename="modele-devis-artisan.${ext}"`)
      expect(res.headers.get("cache-control")).toContain("s-maxage")
      expect((await res.arrayBuffer()).byteLength).toBe(Number(res.headers.get("content-length")))
    }
    expect((await GET(new Request("http://x"), { params: { fichier: "autre.pdf" } })).status).toBe(404)
  })
})

describe("exemple de devis d'électricien : la page et le fichier racontent la même chose", () => {
  const modele = MODELES.find((m) => m.slug === "devis-electricien")!
  const norm = (t: string) => t.replace(/[\u00a0\u202f]/g, " ")

  it("chaque modèle qui annonce un téléchargement a son fichier dans le registre, aux trois formats", () => {
    const annonces = MODELES.filter((m) => m.telechargement)
    expect(annonces.map((m) => m.slug)).toEqual(expect.arrayContaining(["devis-travaux", "devis-electricien"]))
    for (const m of annonces) for (const ext of ["docx", "xlsx", "pdf"]) expect(analyserNomFichier(`${m.telechargement}.${ext}`), `${m.slug}.${ext}`).not.toBeNull()
  })

  it("le fichier Word reprend les lignes et les totaux de l'exemple de la page", () => {
    const t = totauxExemple(modele.exemple!)
    expect(t.ttcCentimes).toBe(178970) // 1 627,00 € HT + 162,70 € de TVA à 10 %
    const doc = norm(lireZip(construireDocx(MODELES_TELECHARGEABLES["exemple-devis-electricien"])).get("word/document.xml")!)
    for (const v of ["1 627,00", "162,70", "1 789,70"]) expect(doc, v).toContain(v)
    for (const l of modele.exemple!.lignes) expect(doc).toContain(l.designation.replace(/&/g, "&amp;"))
    for (const c of modele.exemple!.conditions) expect(doc).toContain(c.replace(/&/g, "&amp;"))
  })

  it("exemple Excel : une ligne de formule par ligne de prestation, nombres bruts", () => {
    const f = lireZip(construireXlsx(MODELES_TELECHARGEABLES["exemple-devis-electricien"])).get("xl/worksheets/sheet1.xml")!
    expect(f).toContain("<v>520</v>")
    expect(f).toContain("<v>78</v>")
    expect(f).toContain("<v>48</v>")
  })

  it("PDF : deux pages", async () => {
    expect((await PDFDocument.load(await construirePdf(MODELES_TELECHARGEABLES["exemple-devis-electricien"]))).getPageCount()).toBe(2)
  })
})

describe("sortie pour contrôle manuel", () => {
  const dossier = process.env.MODELES_SORTIE
  it.skipIf(!dossier)("écrit les fichiers dans MODELES_SORTIE", async () => {
    fs.mkdirSync(dossier!, { recursive: true })
    for (const o of [MODELE_VIERGE, EXEMPLE, MODELES_TELECHARGEABLES["exemple-devis-electricien"]]) {
      for (const f of ["docx", "xlsx", "pdf"] as const) {
        const r = await genererFichierModele(o, f)
        fs.writeFileSync(path.join(dossier!, r.nom), r.data)
      }
    }
  })
})
