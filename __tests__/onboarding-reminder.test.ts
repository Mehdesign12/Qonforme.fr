/**
 * Rappel « Je le ferai plus tard » (lib/onboarding/reminder.ts) : créneaux en
 * heure de Paris (ce soir 19 h, demain 7 h 30, samedi 9 h, autre moment), y
 * compris aux changements d'heure.
 */
import { describe, expect, it } from "vitest"
import { formatReminderMoment, parseParisLocal, reminderSlots, resolveReminderAt } from "@/lib/onboarding/reminder"
import { parisWallTime } from "@/lib/onboarding/paris-time"

const iso = (d: Date) => d.toISOString()
const slotsAt = (now: string) => Object.fromEntries(reminderSlots(new Date(now)).map((s) => [s.key, iso(s.at)]))
const plain = (s: string) => s.replace(/ /g, " ")

describe("créneaux proposés", () => {
  it("samedi 3 octobre 2026, midi (heure d'été)", () => {
    expect(slotsAt("2026-10-03T10:00:00Z")).toEqual({
      tonight: "2026-10-03T17:00:00.000Z", // 19 h à Paris
      tomorrow: "2026-10-04T05:30:00.000Z", // dimanche 7 h 30
      saturday: "2026-10-10T07:00:00.000Z", // samedi suivant 9 h
    })
  })

  it("passage à l'heure d'hiver (dimanche 25 octobre 2026)", () => {
    // Samedi 24 octobre, 8 h à Paris : samedi 9 h, c'est aujourd'hui (heure d'été)
    // et demain 7 h 30 est déjà en heure d'hiver (UTC+1)
    expect(slotsAt("2026-10-24T06:00:00Z")).toEqual({
      tonight: "2026-10-24T17:00:00.000Z",
      tomorrow: "2026-10-25T06:30:00.000Z",
      saturday: "2026-10-24T07:00:00.000Z",
    })
  })

  it("en hiver, 19 h à Paris = 18 h UTC", () => {
    expect(slotsAt("2026-10-31T10:00:00Z")).toEqual({
      tonight: "2026-10-31T18:00:00.000Z",
      tomorrow: "2026-11-01T06:30:00.000Z",
      saturday: "2026-11-07T08:00:00.000Z",
    })
  })

  it("passage à l'heure d'été (dimanche 29 mars 2026)", () => {
    expect(slotsAt("2026-03-28T10:00:00Z").tomorrow).toBe("2026-03-29T05:30:00.000Z") // 7 h 30 en heure d'été
  })

  it("« ce soir » disparaît moins de 30 minutes avant 19 h", () => {
    expect(slotsAt("2026-10-03T16:30:00Z").tonight).toBe("2026-10-03T17:00:00.000Z") // 18 h 30
    expect(slotsAt("2026-10-03T16:45:00Z").tonight).toBeUndefined() // 18 h 45
  })

  it("un créneau passé entre l'affichage et l'envoi est refusé", () => {
    const res = resolveReminderAt({ slot: "tonight" }, new Date("2026-10-03T16:50:00Z"))
    expect(res).toEqual({ error: "Ce créneau est passé. Choisissez-en un autre." })
  })
})

describe("autre moment", () => {
  const now = new Date("2026-10-03T10:00:00Z")

  it("heure de Paris, été comme hiver", () => {
    expect(iso(parseParisLocal("2026-10-10T09:00")!)).toBe("2026-10-10T07:00:00.000Z")
    expect(iso(parseParisLocal("2026-11-10T09:00")!)).toBe("2026-11-10T08:00:00.000Z")
  })

  it("heure qui n'existe pas (2 h 30 le 29 mars) : repoussée à 3 h 30", () => {
    expect(iso(parseParisLocal("2026-03-29T02:30")!)).toBe("2026-03-29T01:30:00.000Z")
  })

  it("heure qui existe deux fois (2 h 30 le 25 octobre) : la première", () => {
    expect(iso(parisWallTime("2026-10-25", 2, 30))).toBe("2026-10-25T00:30:00.000Z")
  })

  it("dates invalides, trop proches ou trop lointaines refusées", () => {
    expect(parseParisLocal("2026-02-30T10:00")).toBeNull()
    expect(parseParisLocal("demain")).toBeNull()
    expect(resolveReminderAt({ slot: "custom", custom: "2026-10-03T12:10" }, now)).toHaveProperty("error")
    expect(resolveReminderAt({ slot: "custom", custom: "2026-11-10T09:00" }, now)).toHaveProperty("error")
    expect(resolveReminderAt({ slot: "custom", custom: "2026-10-20T08:15" }, now)).toEqual({ at: new Date("2026-10-20T06:15:00Z") })
  })
})

describe("libellés", () => {
  const now = new Date("2026-10-03T10:00:00Z")
  it("ce soir, demain, ou le jour en toutes lettres", () => {
    expect(plain(formatReminderMoment(new Date("2026-10-03T17:00:00Z"), now))).toBe("ce soir à 19 h")
    expect(plain(formatReminderMoment(new Date("2026-10-04T05:30:00Z"), now))).toBe("demain à 7 h 30")
    expect(plain(formatReminderMoment(new Date("2026-10-10T07:00:00Z"), now))).toBe("samedi 10 octobre à 9 h")
    expect(plain(formatReminderMoment(new Date("2026-10-31T23:00:00Z"), now))).toBe("dimanche 1er novembre à 0 h")
  })
})
