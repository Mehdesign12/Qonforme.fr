/**
 * Inscription en deux champs (validée par le fondateur le 06/10/2026) : adresse
 * email et mot de passe, rien d'autre. L'entreprise, le métier, la TVA et le
 * prénom se renseignent ensuite dans la fenêtre « Bienvenue » du tableau de bord.
 *
 * Fonctions pures, sans dépendance serveur : la route POST /api/auth/signup les
 * applique, le formulaire (components/auth/SignupForm.tsx) reprend les mêmes
 * seuils pour répondre avant tout envoi.
 */

export const SIGNUP_PASSWORD_MIN = 8
/** Au-delà, Supabase Auth (bcrypt) refuse le mot de passe, en anglais : on le dit en français avant. */
export const SIGNUP_PASSWORD_MAX_BYTES = 72
export const SIGNUP_NAME_MAX = 60
/** RFC 5321 : 254 caractères au plus pour une adresse utilisable. */
export const SIGNUP_EMAIL_MAX = 254
export const SIGNUP_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const SIGNUP_REQUIRED_ERROR = "Adresse email et mot de passe requis."

export interface SignupInput {
  /** Nettoyée et en minuscules. */
  email: string
  password: string
  /** Facultatifs : le formulaire ne les demande plus (fenêtre « Bienvenue »). */
  first_name?: string
  last_name?: string
}

export type SignupParse = { ok: true; value: SignupInput } | { ok: false; error: string }

const NAME_LABELS = {
  first_name: { short: "Prénom", subject: "Le prénom" },
  last_name: { short: "Nom", subject: "Le nom" },
} as const

/** Nom facultatif : absent, vide ou blanc → undefined ; trop long → erreur. */
function optionalName(raw: unknown, key: keyof typeof NAME_LABELS): { ok: true; value?: string } | { ok: false; error: string } {
  const label = NAME_LABELS[key]
  if (raw === undefined || raw === null) return { ok: true }
  if (typeof raw !== "string") return { ok: false, error: `${label.short} invalide.` }
  const value = raw.trim()
  if (!value) return { ok: true }
  if (value.length > SIGNUP_NAME_MAX) {
    return { ok: false, error: `${label.subject} ne peut pas dépasser ${SIGNUP_NAME_MAX} caractères.` }
  }
  return { ok: true, value }
}

/** Corps de POST /api/auth/signup : `{ email, password, first_name?, last_name? }`. */
export function parseSignupInput(body: unknown): SignupParse {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : ""
  const password = typeof b.password === "string" ? b.password : ""
  if (!email || !password) return { ok: false, error: SIGNUP_REQUIRED_ERROR }

  if (email.length > SIGNUP_EMAIL_MAX || !SIGNUP_EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Adresse email invalide." }
  }
  if (password.length < SIGNUP_PASSWORD_MIN) {
    return { ok: false, error: `Le mot de passe doit faire au moins ${SIGNUP_PASSWORD_MIN} caractères.` }
  }
  if (new TextEncoder().encode(password).length > SIGNUP_PASSWORD_MAX_BYTES) {
    return { ok: false, error: `Le mot de passe est trop long : ${SIGNUP_PASSWORD_MAX_BYTES} caractères au plus.` }
  }

  const first = optionalName(b.first_name, "first_name")
  if (!first.ok) return first
  const last = optionalName(b.last_name, "last_name")
  if (!last.ok) return last

  const value: SignupInput = { email, password }
  if (first.value) value.first_name = first.value
  if (last.value) value.last_name = last.value
  return { ok: true, value }
}

/**
 * user_metadata du compte créé. `signup_wizard` marque un compte inscrit par le
 * nouveau parcours : le tableau de bord ouvre la fenêtre « Bienvenue » tant
 * qu'une étape reste à faire (lib/onboarding/inscription.ts).
 */
export function signupMetadata(input: SignupInput): Record<string, string | boolean> {
  const meta: Record<string, string | boolean> = { signup_wizard: true }
  if (input.first_name) meta.first_name = input.first_name
  if (input.last_name) meta.last_name = input.last_name
  return meta
}

/** Erreur de Supabase Auth (admin.createUser) qui signifie « adresse déjà utilisée ». */
export function isAlreadyRegistered(error: { message?: string; code?: string }): boolean {
  if (error.code === "email_exists" || error.code === "user_already_exists") return true
  // « A user with this email address has already been registered » : message
  // actuel de admin.createUser, que l'ancien test « already registered » manquait
  return /already (been )?registered|already exists|duplicate/i.test(error.message ?? "")
}

/**
 * Message français pour les autres refus de Supabase Auth, qui répond en
 * anglais ; null quand le refus n'est pas reconnu (la route garde alors un
 * message générique, jamais le texte anglais brut).
 */
export function signupAuthErrorMessage(error: { message?: string; code?: string }): string | null {
  const m = (error.message ?? "").toLowerCase()
  // « Password should be at least 10 characters » : seuil relevé côté Supabase
  const min = /at least (\d+) characters/.exec(m)
  if (min) return `Le mot de passe doit faire au moins ${min[1]} caractères.`
  if (error.code === "weak_password" || m.includes("weak password") || m.includes("easy to guess")) {
    return "Ce mot de passe est trop facile à deviner : choisissez-en un autre."
  }
  if (error.code === "email_address_invalid" || m.includes("invalid format") || (m.includes("email address") && m.includes("invalid"))) {
    return "Adresse email invalide."
  }
  if (m.includes("password") && m.includes("longer than")) {
    return `Le mot de passe est trop long : ${SIGNUP_PASSWORD_MAX_BYTES} caractères au plus.`
  }
  return null
}
