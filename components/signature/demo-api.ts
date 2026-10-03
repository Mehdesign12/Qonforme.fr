/**
 * Démo de la page du client : mêmes écrans que la vraie page, réponses
 * simulées dans le navigateur. Rien n'est envoyé ni enregistré ; le code de
 * vérification de démonstration est 123456.
 */
import type { PublicSignApi } from "@/components/signature/PublicSignView"

export const DEMO_CODE = "123456"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function demoSignApi(): PublicSignApi {
  return {
    async post(action, body = {}) {
      await wait(450)
      switch (action) {
        case "view":
          return { ok: true, status: 200, json: { ok: true } }
        case "send_code":
          return { ok: true, status: 200, json: { ok: true, sentTo: "votre adresse email" } }
        case "verify_code":
          return body.code === DEMO_CODE
            ? { ok: true, status: 200, json: { ok: true } }
            : { ok: false, status: 400, json: { error: "Code incorrect. En démonstration, le code est 123456." } }
        case "sign": {
          const now = new Date()
          return { ok: true, status: 200, json: { ok: true, signed_at: now.toISOString(), withdrawalDeadline: null } }
        }
        case "refuse":
          return { ok: true, status: 200, json: { ok: true } }
        default:
          return { ok: false, status: 400, json: { error: "Action inconnue" } }
      }
    },
  }
}
