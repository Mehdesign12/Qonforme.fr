/**
 * Inscription en deux champs (06/10/2026) : POST /api/auth/signup accepte une
 * adresse email et un mot de passe seuls, prénom et nom facultatifs (≤ 60) ;
 * le compte porte `signup_wizard: true` ; l'email de bienvenue part sans
 * prénom ; Supabase, qui répond en anglais, n'est jamais recopié tel quel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const created: { email: string; password: string; user_metadata: Record<string, unknown>; email_confirm: boolean }[] = []
let createError: { message: string; status?: number; code?: string } | null = null
const sent: { to: string; subject: string; html: string }[] = []

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: async (o: (typeof created)[number]) => {
          if (createError) return { data: { user: null }, error: createError }
          created.push(o)
          return { data: { user: { id: "3f2b8c1e-5a4d-4e7f-9b2a-1c0d9e8f7a6b" } }, error: null }
        },
      },
    },
  }),
}))
vi.mock("@/lib/onboarding/store", () => ({
  enrollInOnboarding: async () => false,
  claimSequenceStep: async () => true,
}))
vi.mock("@/lib/email/resend", () => ({
  sendEmail: (o: (typeof sent)[number]) => { sent.push(o); return Promise.resolve({ id: "email-1" }) },
}))

import {
  isAlreadyRegistered,
  parseSignupInput,
  signupAuthErrorMessage,
  signupMetadata,
  SIGNUP_REQUIRED_ERROR,
} from "@/lib/auth/signup-input"
import { POST } from "@/app/api/auth/signup/route"

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

describe("parseSignupInput", () => {
  it("email et mot de passe suffisent ; l'adresse est nettoyée et mise en minuscules", () => {
    const r = parseSignupInput({ email: "  Thomas@Garnier.Example.COM ", password: "motdepasse" })
    expect(r).toEqual({ ok: true, value: { email: "thomas@garnier.example.com", password: "motdepasse" } })
  })

  it("email ou mot de passe absent : « Adresse email et mot de passe requis. »", () => {
    expect(parseSignupInput({ email: "a@b.fr" })).toEqual({ ok: false, error: SIGNUP_REQUIRED_ERROR })
    expect(parseSignupInput({ password: "motdepasse" })).toEqual({ ok: false, error: SIGNUP_REQUIRED_ERROR })
    expect(parseSignupInput({ email: "   ", password: "motdepasse" })).toEqual({ ok: false, error: SIGNUP_REQUIRED_ERROR })
    expect(parseSignupInput(null)).toEqual({ ok: false, error: SIGNUP_REQUIRED_ERROR })
    expect(parseSignupInput("texte")).toEqual({ ok: false, error: SIGNUP_REQUIRED_ERROR })
    expect(SIGNUP_REQUIRED_ERROR).toBe("Adresse email et mot de passe requis.")
  })

  it("adresse invalide ou mot de passe hors bornes", () => {
    expect(parseSignupInput({ email: "pas-une-adresse", password: "motdepasse" })).toMatchObject({ ok: false, error: "Adresse email invalide." })
    expect(parseSignupInput({ email: "a@b.fr", password: "court" })).toMatchObject({ ok: false, error: expect.stringMatching(/au moins 8 caractères/) })
    expect(parseSignupInput({ email: "a@b.fr", password: "x".repeat(73) })).toMatchObject({ ok: false, error: expect.stringMatching(/trop long/) })
    // 72 octets au plus : un caractère accentué en compte deux
    expect(parseSignupInput({ email: "a@b.fr", password: "é".repeat(37) })).toMatchObject({ ok: false })
    expect(parseSignupInput({ email: "a@b.fr", password: "x".repeat(72) }).ok).toBe(true)
  })

  it("prénom et nom facultatifs : nettoyés, ignorés s'ils sont vides, 60 caractères au plus", () => {
    expect(parseSignupInput({ email: "a@b.fr", password: "motdepasse", first_name: " Thomas ", last_name: "Garnier" }))
      .toEqual({ ok: true, value: { email: "a@b.fr", password: "motdepasse", first_name: "Thomas", last_name: "Garnier" } })
    expect(parseSignupInput({ email: "a@b.fr", password: "motdepasse", first_name: "  ", last_name: null }))
      .toEqual({ ok: true, value: { email: "a@b.fr", password: "motdepasse" } })
    expect(parseSignupInput({ email: "a@b.fr", password: "motdepasse", first_name: "x".repeat(61) }))
      .toMatchObject({ ok: false, error: expect.stringMatching(/^Le prénom ne peut pas dépasser 60/) })
    expect(parseSignupInput({ email: "a@b.fr", password: "motdepasse", last_name: 42 }))
      .toMatchObject({ ok: false, error: "Nom invalide." })
  })
})

describe("signupMetadata", () => {
  it("marque le compte pour la fenêtre « Bienvenue », noms seulement s'ils sont fournis", () => {
    expect(signupMetadata({ email: "a@b.fr", password: "motdepasse" })).toEqual({ signup_wizard: true })
    expect(signupMetadata({ email: "a@b.fr", password: "motdepasse", first_name: "Thomas" }))
      .toEqual({ signup_wizard: true, first_name: "Thomas" })
  })
})

describe("erreurs de Supabase Auth", () => {
  it("adresse déjà utilisée, par code ou par message", () => {
    expect(isAlreadyRegistered({ code: "email_exists", message: "" })).toBe(true)
    expect(isAlreadyRegistered({ message: "A user with this email address has already been registered" })).toBe(true)
    expect(isAlreadyRegistered({ message: "User already registered" })).toBe(true)
    expect(isAlreadyRegistered({ message: "Password should be at least 6 characters" })).toBe(false)
  })

  it("traduit les refus connus, null sinon", () => {
    expect(signupAuthErrorMessage({ code: "weak_password", message: "Password is known to be weak and easy to guess" }))
      .toMatch(/trop facile à deviner/)
    expect(signupAuthErrorMessage({ code: "weak_password", message: "Password should be at least 10 characters." }))
      .toBe("Le mot de passe doit faire au moins 10 caractères.")
    expect(signupAuthErrorMessage({ code: "email_address_invalid", message: "Email address \"x\" is invalid" }))
      .toBe("Adresse email invalide.")
    expect(signupAuthErrorMessage({ message: "Password cannot be longer than 72 characters" })).toMatch(/trop long/)
    expect(signupAuthErrorMessage({ message: "Signups not allowed for this instance" })).toBeNull()
  })
})

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    created.length = 0
    sent.length = 0
    createError = null
    // La route journalise les refus de Supabase : silencieux pendant les tests
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("crée le compte avec l'email et le mot de passe seuls, marqué signup_wizard", async () => {
    const res = await POST(request({ email: " Thomas@Garnier.example.com", password: "motdepasse" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(created).toEqual([{
      email: "thomas@garnier.example.com",
      password: "motdepasse",
      user_metadata: { signup_wizard: true },
      email_confirm: true,
    }])
  })

  it("email de bienvenue sans prénom : « Bienvenue sur Qonforme »", async () => {
    await POST(request({ email: "thomas@garnier.example.com", password: "motdepasse" }))
    await Promise.resolve()
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe("thomas@garnier.example.com")
    expect(sent[0].subject).toBe("Bienvenue sur Qonforme")
    expect(sent[0].html).not.toContain("undefined")
  })

  it("garde le prénom et le nom fournis (API)", async () => {
    await POST(request({ email: "a@b.fr", password: "motdepasse", first_name: "Thomas", last_name: " Garnier " }))
    expect(created[0].user_metadata).toEqual({ signup_wizard: true, first_name: "Thomas", last_name: "Garnier" })
    expect(sent[0].subject).toBe("Bienvenue sur Qonforme, Thomas")
  })

  it("400 avec un message français, sans rien créer", async () => {
    const missing = await POST(request({ email: "a@b.fr" }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: "Adresse email et mot de passe requis." })

    const short = await POST(request({ email: "a@b.fr", password: "court" }))
    expect(short.status).toBe(400)

    const notJson = await POST(request("{pas du json"))
    expect(notJson.status).toBe(400)
    expect(created).toHaveLength(0)
    expect(sent).toHaveLength(0)
  })

  it("409 already_exists pour une adresse déjà inscrite", async () => {
    createError = { message: "A user with this email address has already been registered", status: 422, code: "email_exists" }
    const res = await POST(request({ email: "a@b.fr", password: "motdepasse" }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "already_exists" })
    expect(sent).toHaveLength(0)
  })

  it("ne recopie jamais un refus anglais de Supabase", async () => {
    createError = { message: "Signups not allowed for this instance", status: 400 }
    const res = await POST(request({ email: "a@b.fr", password: "motdepasse" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).not.toContain("Signups")
    expect(json.error).toMatch(/La création du compte a échoué/)
  })
})
