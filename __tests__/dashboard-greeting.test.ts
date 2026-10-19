import { describe, expect, it } from "vitest"
import { greetingFor, hourInParis } from "@/components/dashboard/model"

describe("salutation du tableau de bord", () => {
  it("bonjour de 5 h à 17 h 59, bonsoir de 18 h à 4 h 59", () => {
    for (const h of [5, 9, 12, 17]) expect(greetingFor(h).word).toBe("Bonjour")
    for (const h of [18, 21, 23, 0, 4]) expect(greetingFor(h).word).toBe("Bonsoir")
  })
  it("une main qui salue le jour, une lune le soir", () => {
    expect(greetingFor(10).emoji).toBe("\u{1F44B}")
    expect(greetingFor(22).emoji).toBe("\u{1F319}")
  })
  it("lit l'heure de Paris, été comme hiver", () => {
    expect(hourInParis(new Date("2026-07-01T16:30:00Z"))).toBe(18) // UTC+2
    expect(hourInParis(new Date("2026-01-15T16:30:00Z"))).toBe(17) // UTC+1
    expect(hourInParis(new Date("2026-01-15T23:30:00Z"))).toBe(0)
  })
})
