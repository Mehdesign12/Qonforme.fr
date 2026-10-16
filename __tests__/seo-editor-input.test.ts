import { describe, expect, it } from "vitest"
import {
  COVER_ALT_MAX,
  COVER_URL_MAX,
  parseCoverAlt,
  parseCoverUrl,
  parseEditorFields,
  parseScheduledAt,
  parseSlug,
  parseTargetKeyword,
  scheduledAtFromParis,
  scheduleProblem,
} from "@/lib/seo/articles/editor-input"

const NOW = new Date("2026-10-16T10:00:00.000Z")

describe("parseScheduledAt", () => {
  it("vide ou null : programmation retirée", () => {
    expect(parseScheduledAt(null, NOW)).toEqual({ ok: true, value: null })
    expect(parseScheduledAt(undefined, NOW)).toEqual({ ok: true, value: null })
    expect(parseScheduledAt("  ", NOW)).toEqual({ ok: true, value: null })
  })

  it("instant à venir avec fuseau : normalisé en UTC", () => {
    expect(parseScheduledAt("2026-10-22T08:00:00+02:00", NOW)).toEqual({ ok: true, value: "2026-10-22T06:00:00.000Z" })
    expect(parseScheduledAt("2026-10-22T06:00:00.000Z", NOW)).toEqual({ ok: true, value: "2026-10-22T06:00:00.000Z" })
    expect(parseScheduledAt("2026-10-22T06:00Z", NOW)).toEqual({ ok: true, value: "2026-10-22T06:00:00.000Z" })
  })

  it("sans fuseau, date seule ou texte : refusé (l'heure serait lue en UTC)", () => {
    for (const v of ["2026-10-22T08:00:00", "2026-10-22", "jeudi prochain", "2026-13-40T08:00:00Z"]) {
      const r = parseScheduledAt(v, NOW)
      expect(r.ok, v).toBe(false)
    }
    expect(parseScheduledAt(42, NOW)).toEqual({ ok: false, error: "Date de publication invalide." })
  })

  it("jour ou heure qui n'existe pas : refusé, jamais reporté au jour suivant", () => {
    // Date.parse ferait du 30 février le 2 mars, et de 24:00 le lendemain à minuit
    for (const v of ["2026-02-30T08:00:00Z", "2026-11-31T08:00:00+01:00", "2026-10-22T24:00:00Z", "2026-10-22T08:60:00Z", "2026-10-22T08:00:00+25:00"]) {
      const r = parseScheduledAt(v, NOW)
      expect(r.ok, v).toBe(false)
    }
    expect(parseScheduledAt("2027-02-28T23:59:59.999+01:00", NOW)).toEqual({ ok: true, value: "2027-02-28T22:59:59.999Z" })
  })

  it("au moins une minute dans le futur", () => {
    const past = parseScheduledAt("2026-10-16T09:59:00Z", NOW)
    expect(past.ok).toBe(false)
    if (!past.ok) expect(past.error).toContain("à venir")
    expect(parseScheduledAt("2026-10-16T10:00:30Z", NOW).ok).toBe(false)
    expect(parseScheduledAt("2026-10-16T10:01:00Z", NOW)).toEqual({ ok: true, value: "2026-10-16T10:01:00.000Z" })
  })

  it("au plus un an à l'avance", () => {
    expect(parseScheduledAt("2027-10-16T09:00:00Z", NOW).ok).toBe(true)
    const far = parseScheduledAt("2027-10-17T10:00:00Z", NOW)
    expect(far.ok).toBe(false)
    if (!far.ok) expect(far.error).toContain("un an")
    expect(parseScheduledAt("2072-10-22T08:00:00Z", NOW).ok).toBe(false)
  })
})

describe("parseTargetKeyword", () => {
  it("forme canonique, accents conservés", () => {
    expect(parseTargetKeyword("  Exemple  Devis   MAÇONNERIE ")).toEqual({ ok: true, value: "exemple devis maçonnerie" })
    expect(parseTargetKeyword("devis d’électricien")).toEqual({ ok: true, value: "devis d'électricien" })
  })

  it("vide ou null : mot-clé retiré", () => {
    expect(parseTargetKeyword("")).toEqual({ ok: true, value: null })
    expect(parseTargetKeyword(null)).toEqual({ ok: true, value: null })
    expect(parseTargetKeyword("   ")).toEqual({ ok: true, value: null })
  })

  it("adresse, trop court, trop long ou pas du texte : refusé", () => {
    expect(parseTargetKeyword("https://qonforme.fr/modele").ok).toBe(false)
    expect(parseTargetKeyword("a").ok).toBe(false)
    expect(parseTargetKeyword("x".repeat(121)).ok).toBe(false)
    expect(parseTargetKeyword(["devis"]).ok).toBe(false)
    expect(parseTargetKeyword("x".repeat(120))).toEqual({ ok: true, value: "x".repeat(120) })
  })
})

describe("parseCoverAlt", () => {
  it("espaces réduits ; vide → null", () => {
    expect(parseCoverAlt("  Un maçon  monte\nun mur  ")).toEqual({ ok: true, value: "Un maçon monte un mur" })
    expect(parseCoverAlt("")).toEqual({ ok: true, value: null })
    expect(parseCoverAlt(null)).toEqual({ ok: true, value: null })
  })

  it("chevrons et longueur", () => {
    expect(parseCoverAlt('Un mur <script>').ok).toBe(false)
    expect(parseCoverAlt("a > b").ok).toBe(false)
    expect(parseCoverAlt("a".repeat(COVER_ALT_MAX)).ok).toBe(true)
    const long = parseCoverAlt("a".repeat(COVER_ALT_MAX + 1))
    expect(long.ok).toBe(false)
    if (!long.ok) expect(long.error).toContain("300")
  })
})

describe("parseEditorFields", () => {
  it("ne garde que les champs présents", () => {
    expect(parseEditorFields({ title: "x" }, NOW)).toEqual({ ok: true, value: {} })
    expect(parseEditorFields({ target_keyword: "Devis Placo", cover_alt: null, scheduled_at: null }, NOW)).toEqual({
      ok: true,
      value: { target_keyword: "devis placo", cover_alt: null, scheduled_at: null },
    })
    expect(parseEditorFields(null, NOW)).toEqual({ ok: true, value: {} })
  })

  it("première erreur rendue", () => {
    const r = parseEditorFields({ target_keyword: "https://exemple.fr/a", scheduled_at: "hier" }, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain("adresse web")
    const s = parseEditorFields({ scheduled_at: "2026-10-01T08:00:00Z" }, NOW)
    expect(s.ok).toBe(false)
  })
})

describe("jour et heure de Paris", () => {
  it("heure d'été et heure d'hiver", () => {
    // 22 octobre 2026 : heure d'été (UTC+2) ; 2 novembre : heure d'hiver (UTC+1)
    expect(scheduledAtFromParis("2026-10-22", "08:00")).toBe("2026-10-22T06:00:00.000Z")
    expect(scheduledAtFromParis("2026-11-02", "08:00")).toBe("2026-11-02T07:00:00.000Z")
  })

  it("jour ou heure invalide : null", () => {
    expect(scheduledAtFromParis("2026-02-30", "08:00")).toBeNull()
    expect(scheduledAtFromParis("2026-10-22", "8h")).toBeNull()
    expect(scheduledAtFromParis("", "08:00")).toBeNull()
  })

  it("ce qui empêche de programmer, en français", () => {
    expect(scheduleProblem("", "08:00", NOW)).toBe("Choisissez le jour de publication.")
    expect(scheduleProblem("2026-10-22", "", NOW)).toBe("Choisissez l'heure de publication.")
    expect(scheduleProblem("2026-10-16", "08:00", NOW)).toContain("à venir")
    expect(scheduleProblem("2026-10-16", "13:00", NOW)).toBeNull()
    expect(scheduleProblem("2026-10-22", "08:00", NOW)).toBeNull()
  })
})

describe("parseSlug", () => {
  it("tirets en trop retirés, adresse contrôlée", () => {
    expect(parseSlug("  devis--placo-  ")).toEqual({ ok: true, value: "devis-placo" })
    expect(parseSlug("exemple-devis-maconnerie-2026")).toEqual({ ok: true, value: "exemple-devis-maconnerie-2026" })
  })

  it("vide, majuscules, accents, barres ou trop long : refusé", () => {
    expect(parseSlug("").ok).toBe(false)
    expect(parseSlug("---").ok).toBe(false)
    expect(parseSlug(null).ok).toBe(false)
    for (const v of ["Devis-Placo", "devis-maçon", "blog/devis", "devis placo", "a".repeat(121)]) {
      expect(parseSlug(v).ok, v).toBe(false)
    }
  })
})

describe("parseCoverUrl", () => {
  it("adresse web complète ou chemin du site ; vide → null ; fragment des dimensions gardé", () => {
    const url = "https://lxnowrmyyaylvnognifu.supabase.co/storage/v1/object/public/blog-images/2026/10/x.webp#w=1600&h=900"
    expect(parseCoverUrl(url)).toEqual({ ok: true, value: url })
    expect(parseCoverUrl("  /images/couverture.jpg ")).toEqual({ ok: true, value: "/images/couverture.jpg" })
    expect(parseCoverUrl("")).toEqual({ ok: true, value: null })
    expect(parseCoverUrl(null)).toEqual({ ok: true, value: null })
  })

  it("protocole, adresse relative au protocole, guillemets, chevrons, espaces, longueur : refusé", () => {
    for (const v of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//exemple.fr/x.jpg",
      "ftp://exemple.fr/x.jpg",
      'https://exemple.fr/x.jpg" onerror="x',
      "https://exemple.fr/<x>.jpg",
      "https://exemple.fr/une image.jpg",
      "image.jpg",
      `https://exemple.fr/${"a".repeat(COVER_URL_MAX)}`,
      42,
    ]) {
      expect(parseCoverUrl(v).ok, String(v)).toBe(false)
    }
  })
})
