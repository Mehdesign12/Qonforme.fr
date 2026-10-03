/**
 * Recherche d'une entreprise au répertoire Sirene (INSEE) depuis la fiche client.
 *
 * - SIREN (9 chiffres) : /api/sirene, comme l'inscription et les paramètres
 *   de l'entreprise — raison sociale et adresse du siège ;
 * - SIRET (14 chiffres) : /api/outils/siret, seule route qui résout un
 *   établissement — raison sociale et adresse de cet établissement.
 * Le numéro de TVA intracommunautaire est calculé depuis le SIREN.
 */
import { isValidSiren, sirenToVAT } from "@/lib/utils/invoice"

export interface CompanyLookup {
  siren: string
  name: string
  vat_number: string
  address: string
  zip_code: string
  city: string
  /** Entreprise fermée au répertoire Sirene. */
  closed: boolean
}

export type LookupOutcome =
  | { status: "found"; company: CompanyLookup }
  | { status: "invalid"; message: string }
  | { status: "notfound" }
  | { status: "error" }

export async function lookupCompany(raw: string): Promise<LookupOutcome> {
  const digits = raw.replace(/[\s.]/g, "")
  if (!/^\d+$/.test(digits) || (digits.length !== 9 && digits.length !== 14)) {
    return { status: "invalid", message: "Saisissez les 9 chiffres du SIREN ou les 14 du SIRET." }
  }
  if (!isValidSiren(digits.slice(0, 9))) {
    return { status: "invalid", message: "Ce numéro n'est pas valide : sa clé de contrôle ne correspond pas." }
  }

  try {
    const res = digits.length === 9
      ? await fetch(`/api/sirene?siren=${digits}`)
      : await fetch(`/api/outils/siret?q=${digits}`)
    if (res.status === 404) return { status: "notfound" }
    if (!res.ok) return { status: "error" }
    const data = await res.json()
    const siren = String(data.siren || digits.slice(0, 9))
    if (!data.name) return { status: "notfound" }
    return {
      status: "found",
      company: {
        siren,
        name: String(data.name),
        vat_number: sirenToVAT(siren),
        address: data.address ? String(data.address) : "",
        zip_code: data.zip_code ? String(data.zip_code) : "",
        city: data.city ? String(data.city) : "",
        closed: data.closed === true,
      },
    }
  } catch {
    return { status: "error" }
  }
}
