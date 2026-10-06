/**
 * Démo de la fenêtre « Bienvenue » (/demo/bienvenue) : la recherche
 * d'entreprise répond sans réseau, avec les résultats fictifs de la maquette
 * (canevas « Inscription en deux champs »). SIREN volontairement fictifs,
 * comme le reste de la démo (components/layout/shell.ts).
 */
import type { SireneCandidate } from "@/lib/utils/sirene"

export const DEMO_CANDIDATES: readonly SireneCandidate[] = [
  {
    siren: "948211375",
    name: "GARNIER PLÂTRERIE ISOLATION",
    legal_form: "societe",
    company_type: "SARL",
    legal_form_label: "SARL",
    address: "14 rue des Lices",
    zip_code: "49100",
    city: "Angers",
    activity_code: "43.31Z",
    closed: false,
  },
  {
    siren: "951384207",
    name: "THOMAS GARNIER",
    first_name: "Thomas",
    legal_form: "ei",
    company_type: null,
    legal_form_label: "Entrepreneur individuel",
    address: "3 rue du Port",
    zip_code: "49130",
    city: "Les Ponts-de-Cé",
    activity_code: "43.31Z",
    closed: false,
  },
  {
    siren: "512649083",
    name: "PLÂTRERIE GARNIER ET FILS",
    legal_form: "societe",
    company_type: "SAS",
    legal_form_label: "SAS",
    address: "",
    zip_code: "72000",
    city: "Le Mans",
    activity_code: "43.31Z",
    closed: true,
  },
]

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/**
 * Recherche de la démo : par numéro (début du SIREN) ; sinon un des mots
 * saisis doit apparaître dans le nom (sans tenir compte des accents) et les
 * nombres dans le code postal (« garnier 49 »). « dupont » ne trouve rien : la
 * démo montre aussi la saisie à la main.
 */
export function demoSearch(query: string): SireneCandidate[] {
  const digits = query.replace(/\s/g, "")
  if (/^\d+$/.test(digits)) {
    const siren = digits.slice(0, 9)
    return DEMO_CANDIDATES.filter((c) => c.siren.startsWith(siren))
  }
  const words = fold(query).split(/\s+/).filter(Boolean)
  const numbers = words.filter((w) => /^\d+$/.test(w))
  const names = words.filter((w) => !/^\d+$/.test(w) && w.length >= 3)
  if (!names.length) return []
  return DEMO_CANDIDATES.filter((c) => {
    const name = fold(c.name)
    return names.some((w) => name.includes(w)) && numbers.every((n) => c.zip_code.startsWith(n))
  })
}
