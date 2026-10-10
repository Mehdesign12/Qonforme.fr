/**
 * Échéance du résumé hebdomadaire SEO : semaine ISO (clé anti-doublon),
 * jour et heure de Paris (heure d'été comprise), prochain envoi affiché.
 */
import { describe, expect, it } from "vitest"
import { fmtNextSend, isDigestDue, isoWeekKey, nextDigestSend, weekdayOf } from "@/lib/seo/reports/schedule"

const NBSP = "\u00A0"
const monday8 = { weeklyDigest: true, weekday: 1, time: "08:00" }

describe("semaine ISO", () => {
  it("numérote la semaine du lundi au dimanche", () => {
    expect(isoWeekKey("2026-10-05")).toBe("2026-W41")
    expect(isoWeekKey("2026-10-09")).toBe("2026-W41")
    expect(isoWeekKey("2026-10-11")).toBe("2026-W41")
    expect(isoWeekKey("2026-10-12")).toBe("2026-W42")
  })

  it("rattache les jours de bord d'année à la bonne année ISO", () => {
    expect(isoWeekKey("2021-01-03")).toBe("2020-W53")
    expect(isoWeekKey("2026-12-31")).toBe("2026-W53")
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53")
    expect(isoWeekKey("2027-01-04")).toBe("2027-W01")
    expect(isoWeekKey("2025-12-29")).toBe("2026-W01")
  })

  it("donne le jour de la semaine d'une date", () => {
    expect(weekdayOf("2026-10-12")).toBe(1)
    expect(weekdayOf("2026-10-11")).toBe(7)
  })
})

describe("échéance", () => {
  it("le jour choisi, à partir de l'heure choisie, heure de Paris (été)", () => {
    // 12 oct. 2026 : heure d'été, Paris = UTC+2
    expect(isDigestDue(monday8, new Date("2026-10-12T05:59:00Z"))).toBe(false)
    expect(isDigestDue(monday8, new Date("2026-10-12T06:00:00Z"))).toBe(true)
    expect(isDigestDue(monday8, new Date("2026-10-12T21:30:00Z"))).toBe(true)
    expect(isDigestDue(monday8, new Date("2026-10-13T06:00:00Z"))).toBe(false)
  })

  it("suit l'heure d'hiver", () => {
    // 2 nov. 2026 : heure d'hiver, Paris = UTC+1
    expect(isDigestDue(monday8, new Date("2026-11-02T06:30:00Z"))).toBe(false)
    expect(isDigestDue(monday8, new Date("2026-11-02T07:00:00Z"))).toBe(true)
  })

  it("jamais quand le résumé est éteint", () => {
    expect(isDigestDue({ ...monday8, weeklyDigest: false }, new Date("2026-10-12T06:00:00Z"))).toBe(false)
  })
})

describe("prochain envoi", () => {
  it("le prochain jour choisi", () => {
    const next = nextDigestSend(monday8, new Date("2026-10-09T08:00:00Z"), false)
    expect(next).toEqual({ day: "2026-10-12", time: "08:00", pendingNow: false })
    expect(fmtNextSend(next)).toBe(`Lundi 12${NBSP}oct.${NBSP}2026 à 08:00 (Paris)`)
  })

  it("au prochain passage si l'échéance est passée sans envoi cette semaine", () => {
    const next = nextDigestSend(monday8, new Date("2026-10-12T07:00:00Z"), false)
    expect(next?.pendingNow).toBe(true)
    expect(fmtNextSend(next)).toMatch(/^Aujourd'hui, au prochain passage/)
  })

  it("la semaine suivante si le résumé de la semaine existe déjà", () => {
    expect(nextDigestSend(monday8, new Date("2026-10-12T07:00:00Z"), true)?.day).toBe("2026-10-19")
    // Plus tard dans la semaine, rien n'est envoyé en rattrapage : lundi suivant
    expect(nextDigestSend(monday8, new Date("2026-10-14T07:00:00Z"), false)?.day).toBe("2026-10-19")
  })

  it("aucun envoi quand le résumé est éteint", () => {
    expect(nextDigestSend({ ...monday8, weeklyDigest: false }, new Date("2026-10-09T08:00:00Z"), false)).toBeNull()
    expect(fmtNextSend(null)).toBe("—")
  })
})
