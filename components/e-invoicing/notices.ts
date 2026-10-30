/** Messages affichés au retour de Super PDP ou d'un départ refusé (paramètres `erreur` et `raccordement`). */
import type { HubNotice } from "@/components/e-invoicing/EInvoicingHub"

const ERRORS: Record<string, HubNotice> = {
  formule: { tone: "warn", text: "Le raccordement est inclus dans Essentiel : choisissez la formule pour l'activer." },
  indisponible: { tone: "warn", text: "Le raccordement automatique n'est pas encore ouvert sur ce compte." },
  lecture: { tone: "danger", text: "Vérification impossible pour le moment. Réessayez dans un instant." },
  session: { tone: "warn", text: "Le retour de Super PDP n'a pas pu être vérifié (délai dépassé ou autre session). Recommencez depuis cette page." },
  echange: { tone: "danger", text: "Super PDP a refusé l'autorisation transmise. Recommencez le raccordement." },
  plateforme: { tone: "warn", text: "Super PDP ne répond pas pour le moment. Réessayez dans quelques minutes." },
  enregistrement: { tone: "danger", text: "L'autorisation n'a pas pu être enregistrée. Réessayez." },
}

const RETURNS: Record<string, HubNotice> = {
  annule: { tone: "info", text: "Raccordement interrompu chez Super PDP : rien n'a été activé." },
  retour: { tone: "ok", text: "De retour de Super PDP : voici où en est votre raccordement." },
}

export function noticeFromQuery(params: { get(name: string): string | null }): HubNotice | null {
  const err = params.get("erreur")
  if (err && ERRORS[err]) return ERRORS[err]
  const ret = params.get("raccordement")
  if (ret && RETURNS[ret]) return RETURNS[ret]
  return null
}
