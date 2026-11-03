/**
 * Choix du canal d'envoi d'une facture : par la plateforme agréée (Super PDP)
 * ou par email (canevas, planches D14 et M13). Module pur, partagé par l'API
 * (qui décide) et la fenêtre d'envoi (qui affiche).
 *
 * La plateforme est proposée quand tout est réuni : envoi par la plateforme
 * ouvert pour le mode du compte, migration appliquée, raccordement actif,
 * formule, client professionnel avec un SIREN, et au moins une adresse active
 * dans l'annuaire de la facturation électronique. Sinon, l'email, comme avant,
 * avec la raison dite quand l'artisan est raccordé.
 *
 * Annuaire (relevé du 03/11/2026, public, sans jeton) : une entreprise peut
 * avoir plusieurs adresses (une par service ou par site, suffixe après le
 * SIREN) et son adresse « SIREN seul » peut être inactive (ex. 552081317) :
 * alors l'artisan choisit l'adresse que son client lui a donnée. Une entreprise
 * absente de l'annuaire n'a pas encore désigné de plateforme : email.
 *
 * Bac à sable (compte d'essai) : l'annuaire officiel ne connaît pas les
 * entreprises fictives de Super PDP (adresses « 315143296_XXX »). L'adresse se
 * saisit alors à la main, sans exiger de SIREN ; Super PDP la contrôle au dépôt.
 * Jamais en production : on n'y envoie qu'à une adresse active de l'annuaire.
 */
import type { PaMode } from "@/lib/pa/superpdp/config"

/**
 * Modes dans lesquels l'envoi par la plateforme est ouvert. Vide tant que le
 * dépôt (lot 3) n'est pas livré ; le bac à sable seul (comptes d'essai) depuis
 * le lot 3 (03/11/2026) ; la production une fois l'essai complet réussi.
 */
export const PLATFORM_SENDING_MODES: readonly PaMode[] = ["test"]

export const ADDRESS_SCHEME = "0225"

export interface DirectoryAddress {
  /** Identifiant complet, ex. « 0225:552081317_DCNEM5200TDA ». */
  identifier: string
  /** Adresse « SIREN seul » de l'entreprise. */
  main: boolean
}

export type PlatformUnavailable =
  | "disabled"           // pas encore ouvert pour ce mode
  | "not_installed"      // migration absente
  | "not_connected"      // pas de raccordement, ou raccordement pas encore actif
  | "no_plan"            // compte sans formule
  | "particulier"        // client sans SIREN
  | "abroad"             // client hors de France
  | "not_in_directory"   // client absent de l'annuaire
  | "directory_down"     // annuaire injoignable
  | "already_sent"       // déjà déposée chez la plateforme (ou envoi en cours)

export interface DeliveryOptions {
  platform:
    | { offered: true; addresses: DirectoryAddress[]; defaultAddress: string | null; sender: string | null; manualEntry: boolean }
    | { offered: false; reason: PlatformUnavailable }
  email: { offered: boolean; to: string | null }
  recommended: "platform" | "email"
  /** L'artisan est raccordé : la raison d'un envoi par email mérite d'être dite. */
  connected: boolean
}

/** Phrase affichée quand la plateforme n'est pas proposée (artisan raccordé seulement). */
export const PLATFORM_UNAVAILABLE_TEXT: Record<PlatformUnavailable, string> = {
  disabled: "L'envoi par la plateforme agréée n'est pas encore ouvert.",
  not_installed: "L'envoi par la plateforme agréée n'est pas encore ouvert.",
  not_connected: "Votre raccordement à la plateforme agréée n'est pas encore actif.",
  no_plan: "L'envoi par la plateforme agréée est inclus dans Essentiel.",
  particulier: "Client particulier : la facture part par email.",
  abroad: "Client établi hors de France : la facture part par email.",
  not_in_directory: "Votre client n'est pas encore inscrit dans l'annuaire de la facturation électronique : la facture part par email.",
  directory_down: "L'annuaire de la facturation électronique ne répond pas pour le moment : la facture part par email.",
  already_sent: "Cette facture a déjà été transmise par la plateforme agréée : vous pouvez en renvoyer une copie par email.",
}

const ADDRESS_RE = /^0225:[A-Za-z0-9_.-]{1,100}$/

/** Adresse de facturation électronique valide (schéma 0225), sans espace ni casse modifiée. */
export function normalizeAddress(input: string | null | undefined): string | null {
  const s = (input ?? "").trim()
  const full = /^0225:/.test(s) ? s : s ? `0225:${s}` : ""
  return ADDRESS_RE.test(full) ? full : null
}

/** Adresse donnée par l'artisan : elle appartient bien à l'entreprise du client (même SIREN). */
export function addressMatchesSiren(address: string, siren: string): boolean {
  const id = address.replace(/^0225:/, "")
  return id === siren || id.startsWith(`${siren}_`)
}

/** Entrées actives de l'annuaire pour ce SIREN, l'adresse principale en tête. */
export function activeAddresses(entries: readonly { identifier: string; is_active: boolean }[], siren: string): DirectoryAddress[] {
  const seen = new Set<string>()
  const out: DirectoryAddress[] = []
  for (const e of entries) {
    const id = normalizeAddress(e.identifier)
    if (!e.is_active || !id || seen.has(id) || !addressMatchesSiren(id, siren)) continue
    seen.add(id)
    out.push({ identifier: id, main: id === `0225:${siren}` })
  }
  return out.sort((a, b) => Number(b.main) - Number(a.main) || a.identifier.localeCompare(b.identifier))
}

/** Adresse choisie d'office : l'adresse principale, ou la seule adresse active ; sinon à choisir. */
export function defaultAddress(addresses: readonly DirectoryAddress[]): string | null {
  const main = addresses.find((a) => a.main)
  if (main) return main.identifier
  return addresses.length === 1 ? addresses[0].identifier : null
}

const sirenOf = (s: string | null | undefined): string | null => {
  const d = (s ?? "").replace(/\s/g, "")
  return /^\d{9}$/.test(d) ? d : null
}

export interface DeliveryInput {
  mode: PaMode | null
  outboundInstalled: boolean
  connection: { status: string; address: string | null } | null
  hasPlan: boolean
  client: { email?: string | null; siren?: string | null; country?: string | null } | null
  /** Entrées de l'annuaire pour le SIREN du client ; null si l'annuaire n'a pas répondu, undefined s'il n'a pas été consulté. */
  directory?: readonly { identifier: string; is_active: boolean }[] | null
  /** Envoi déjà déposé (ou en cours) pour ce document : pas de second envoi par la plateforme. */
  alreadySent?: boolean
}

/** Faut-il consulter l'annuaire ? Seulement quand tout le reste permet la plateforme. */
export function needsDirectory(input: Omit<DeliveryInput, "directory">): string | null {
  return platformBlocker(input) ? null : sirenOf(input.client?.siren)
}

function platformBlocker(input: Omit<DeliveryInput, "directory">): PlatformUnavailable | null {
  if (!input.mode || !PLATFORM_SENDING_MODES.includes(input.mode)) return "disabled"
  if (!input.outboundInstalled) return "not_installed"
  if (!input.connection || input.connection.status !== "active") return "not_connected"
  if (!input.hasPlan) return "no_plan"
  if (input.alreadySent) return "already_sent"
  if (input.mode === "test") return null
  const country = (input.client?.country ?? "FR").trim().toUpperCase() || "FR"
  if (country !== "FR") return "abroad"
  if (!sirenOf(input.client?.siren)) return "particulier"
  return null
}

export function deliveryOptions(input: DeliveryInput): DeliveryOptions {
  const to = input.client?.email?.trim() || null
  const email = { offered: !!to, to }
  const connected = input.connection?.status === "active"
  const blocker = platformBlocker(input)
  const off = (reason: PlatformUnavailable): DeliveryOptions => ({ platform: { offered: false, reason }, email, recommended: "email", connected })
  if (blocker) return off(blocker)
  const siren = sirenOf(input.client?.siren)
  const manualEntry = input.mode === "test"
  if (input.directory === null && !manualEntry) return off("directory_down")
  const addresses = siren ? activeAddresses(input.directory ?? [], siren) : []
  if (addresses.length === 0 && !manualEntry) return off("not_in_directory")
  return {
    platform: { offered: true, addresses, defaultAddress: defaultAddress(addresses), sender: input.connection?.address ?? null, manualEntry },
    email,
    recommended: "platform",
    connected,
  }
}

/** Choix reçu par la route d'envoi : canal et adresse, contrôlés contre les options. */
export type DeliveryChoice = { channel: "email"; email?: string } | { channel: "platform"; address: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Adresse email tapée dans la fenêtre d'envoi (client qui n'en avait pas) : valide, ou null. */
export function normalizeEmail(input: unknown): string | null {
  const s = typeof input === "string" ? input.trim().toLowerCase() : ""
  return s.length <= 254 && EMAIL_RE.test(s) ? s : null
}

export function parseDeliveryChoice(body: unknown): DeliveryChoice | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as { channel?: unknown; address?: unknown }
  if (b.channel === undefined || b.channel === "email") {
    const raw = (body as { email?: unknown } | null)?.email
    if (raw === undefined || raw === null || raw === "") return { channel: "email" }
    const email = normalizeEmail(raw)
    return email ? { channel: "email", email } : { error: "Adresse email du client invalide." }
  }
  if (b.channel !== "platform") return { error: "Canal d'envoi inconnu." }
  const address = normalizeAddress(typeof b.address === "string" ? b.address : null)
  if (!address) return { error: "Choisissez l'adresse de facturation électronique de votre client." }
  return { channel: "platform", address }
}

/** L'adresse choisie fait partie des adresses actives proposées. */
export function choiceAllowed(options: DeliveryOptions, choice: DeliveryChoice): boolean {
  if (choice.channel === "email") return options.email.offered
  if (!options.platform.offered) return false
  return options.platform.manualEntry || options.platform.addresses.some((a) => a.identifier === choice.address)
}
