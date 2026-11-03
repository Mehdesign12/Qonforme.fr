/**
 * Envoi d'un devis ou d'un bon de commande à un client sans adresse email :
 * l'adresse tapée dans la fenêtre d'envoi est validée puis enregistrée sur la
 * fiche du client ; sans adresse, la route répond 422 avec un code que
 * l'éditeur reconnaît pour ouvrir la fenêtre d'envoi au lieu d'une erreur.
 */
import { describe, expect, it, vi } from "vitest"
import { resolveRecipient } from "@/lib/email/recipient"
import { CLIENT_EMAIL_REQUIRED, needsClientEmail, sendWindowHref } from "@/lib/email/client-email"

function fakeSupabase(error: unknown = null) {
  const calls: Array<{ table: string; values: unknown; filters: Array<[string, unknown]> }> = []
  const supabase = {
    from(table: string) {
      return {
        update(values: unknown) {
          const call = { table, values, filters: [] as Array<[string, unknown]> }
          calls.push(call)
          const chain = {
            eq(col: string, val: unknown) {
              call.filters.push([col, val])
              return call.filters.length >= 2 ? Promise.resolve({ error }) : chain
            },
          }
          return chain
        },
      }
    },
  }
  return { supabase: supabase as never, calls }
}

const req = (body?: unknown) =>
  new Request("http://x/api", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })

describe("resolveRecipient", () => {
  it("garde l'adresse de la fiche sans lire le corps", async () => {
    const { supabase, calls } = fakeSupabase()
    const r = await resolveRecipient(req({ email: "autre@x.fr" }), supabase, "u1", { id: "c1", email: "fiche@x.fr" })
    expect(r).toEqual({ email: "fiche@x.fr" })
    expect(calls).toHaveLength(0)
  })

  it("enregistre l'adresse tapée sur la fiche du client", async () => {
    const { supabase, calls } = fakeSupabase()
    const r = await resolveRecipient(req({ email: "  Client@Exemple.FR " }), supabase, "u1", { id: "c1", email: null })
    expect(r).toEqual({ email: "client@exemple.fr" })
    expect(calls).toEqual([{ table: "clients", values: { email: "client@exemple.fr" }, filters: [["id", "c1"], ["user_id", "u1"]] }])
  })

  it("sans adresse : 422 avec le code reconnu par l'éditeur", async () => {
    const { supabase } = fakeSupabase()
    const r = await resolveRecipient(req(), supabase, "u1", { id: "c1", email: null })
    expect("response" in r && r.response.status).toBe(422)
    const json = "response" in r ? await r.response.json() : null
    expect(json.code).toBe(CLIENT_EMAIL_REQUIRED)
    expect(needsClientEmail(422, json)).toBe(true)
  })

  it("adresse invalide : 400, rien d'écrit", async () => {
    const { supabase, calls } = fakeSupabase()
    const r = await resolveRecipient(req({ email: "pas-une-adresse" }), supabase, "u1", { id: "c1", email: null })
    expect("response" in r && r.response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it("échec d'écriture sur la fiche : 500, pas d'envoi", async () => {
    const { supabase } = fakeSupabase({ message: "boom" })
    const r = await resolveRecipient(req({ email: "a@b.fr" }), supabase, "u1", { id: "c1", email: null })
    expect("response" in r && r.response.status).toBe(500)
  })
})

describe("needsClientEmail", () => {
  it("ne confond pas avec une autre erreur 422", () => {
    expect(needsClientEmail(422, { error: "autre" })).toBe(false)
    expect(needsClientEmail(409, { code: CLIENT_EMAIL_REQUIRED })).toBe(false)
    expect(sendWindowHref("/quotes/q1")).toBe("/quotes/q1?send=1")
  })
})
