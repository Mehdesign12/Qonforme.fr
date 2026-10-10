import { describe, expect, it } from "vitest"
import { monthGrid, monthLabel, nextSlots, parisDayTime, parisInstant, parseMonth, rhythmWeekdays, shiftMonth, weekLabel, weekdayDay } from "@/lib/seo/articles/schedule"

const NBSP = " "

describe("heure de Paris", () => {
  it("convertit une heure de Paris en UTC, heure d'été comme d'hiver (changement du 25 octobre 2026)", () => {
    expect(parisInstant("2026-10-19", "08:00").toISOString()).toBe("2026-10-19T06:00:00.000Z")
    expect(parisInstant("2026-10-26", "08:00").toISOString()).toBe("2026-10-26T07:00:00.000Z")
    expect(parisInstant("2026-10-25", "08:00").toISOString()).toBe("2026-10-25T07:00:00.000Z")
    expect(parisInstant("2027-03-29", "08:00").toISOString()).toBe("2027-03-29T06:00:00.000Z")
  })

  it("rend le jour et l'heure de Paris d'un instant", () => {
    expect(parisDayTime("2026-10-07T19:19:00Z")).toEqual({ day: "2026-10-07", time: "21:19" })
    expect(parisDayTime("2026-10-31T23:30:00Z")).toEqual({ day: "2026-11-01", time: "00:30" })
  })
})

describe("rythme de publication", () => {
  it("répartit les jours dans la semaine", () => {
    expect(rhythmWeekdays(1, 1)).toEqual([1])
    expect(rhythmWeekdays(2, 1)).toEqual([1, 4])
    expect(rhythmWeekdays(3, 1)).toEqual([1, 3, 5])
    expect(rhythmWeekdays(2, 6)).toEqual([2, 6])
    expect(rhythmWeekdays(0, 1)).toEqual([])
  })

  it("propose les lundis à 08:00, heure de Paris, de part et d'autre du changement d'heure", () => {
    const slots = nextSlots({ now: new Date("2026-10-09T10:00:00Z"), perWeek: 1, weekday: 1, time: "08:00", count: 3 })
    expect(slots.map((s) => s.at)).toEqual(["2026-10-12T06:00:00.000Z", "2026-10-19T06:00:00.000Z", "2026-10-26T07:00:00.000Z"])
    expect(slots[0]).toMatchObject({ day: "2026-10-12", time: "08:00" })
  })

  it("rythme à 0 : aucun créneau automatique", () => {
    expect(nextSlots({ now: new Date("2026-10-09T10:00:00Z"), perWeek: 0, weekday: 1, time: "08:00", count: 3 })).toEqual([])
  })

  it("saute les jours déjà occupés et l'heure déjà passée", () => {
    const slots = nextSlots({ now: new Date("2026-10-12T05:30:00Z"), perWeek: 1, weekday: 1, time: "08:00", count: 2, takenDays: ["2026-10-19"] })
    // Lundi 12 à 08:00 (06:00 UTC) est à moins d'une heure : pas proposé
    expect(slots.map((s) => s.day)).toEqual(["2026-10-26", "2026-11-02"])
  })
})

describe("mois du calendrier", () => {
  it("octobre 2026 : 5 semaines du lundi 28 septembre au dimanche 1er novembre", () => {
    const weeks = monthGrid("2026-10")
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toBe("2026-09-28")
    expect(weeks[4][6]).toBe("2026-11-01")
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it("libellés et navigation", () => {
    expect(monthLabel("2026-10")).toBe("Octobre 2026")
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(parseMonth("2026-13")).toBeNull()
    expect(parseMonth("2026-10")).toBe("2026-10")
    expect(weekLabel("2026-09-28")).toBe(`Semaine du 28${NBSP}sept. au 4${NBSP}oct.`)
    expect(weekLabel("2026-10-05")).toBe(`Semaine du 5 au 11${NBSP}oct.`)
    expect(weekLabel("2026-10-26")).toBe(`Semaine du 26${NBSP}oct. au 1er${NBSP}nov.`)
    expect(weekdayDay("2026-10-07")).toBe(`Mer.${NBSP}7${NBSP}oct.`)
  })
})
