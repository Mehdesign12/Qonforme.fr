/**
 * Copie locale d'un document en cours de création (devis, facture, bon de commande).
 *
 * Constat du 08/11/2026 (enregistrements PostHog) : trois nouveaux inscrits sur trois ont
 * tapé leur premier devis puis l'ont perdu, sans jamais cliquer sur « Enregistrer le
 * brouillon ». Tant que le document ne peut pas être enregistré sur le serveur (pas encore
 * de client, ligne incomplète), sa saisie est gardée ici, sur l'appareil, et reprise à la
 * réouverture de l'éditeur. Dès qu'il est enregistré sur le serveur, la copie est effacée.
 *
 * Stockage local seulement, par compte (`owner`) : la copie d'un compte n'est jamais
 * reprise par un autre, et la déconnexion les efface toutes (`clearAllLocalDrafts`).
 * Relue sans confiance : forme vérifiée champ par champ, copie de plus de 14 jours ignorée.
 */
import type { DocForm, DocKind, DocLine, VatRate } from "@/components/documents/model"

const PREFIX = "qonforme:draft:"
export const LOCAL_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
const VAT: VatRate[] = [0, 5.5, 10, 20]

export interface LocalDraft {
  savedAt: number
  form: DocForm
}

export function localDraftKey(kind: DocKind, owner: string): string {
  return `${PREFIX}${kind}:${owner}`
}

const str = (v: unknown, max = 5000): string => (typeof v === "string" ? v.slice(0, max) : "")

function parseLine(raw: unknown): DocLine | null {
  if (!raw || typeof raw !== "object") return null
  const l = raw as Record<string, unknown>
  const vat = Number(l.vat_rate)
  return {
    id: str(l.id, 64) || crypto.randomUUID(),
    description: str(l.description),
    quantity: str(l.quantity, 32) || "1",
    unit_price_ht: str(l.unit_price_ht, 32),
    vat_rate: (VAT.includes(vat as VatRate) ? vat : 20) as VatRate,
    discount_kind: l.discount_kind === "eur" ? "eur" : "pct",
    discount_value: str(l.discount_value, 32),
  }
}

/** Relit une copie ; `null` si absente, illisible, trop ancienne ou d'une autre forme. */
export function parseLocalDraft(raw: string | null, now = Date.now()): LocalDraft | null {
  if (!raw) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const savedAt = Number(d.savedAt)
  if (!Number.isFinite(savedAt) || now - savedAt > LOCAL_DRAFT_MAX_AGE_MS || savedAt > now + 60_000) return null
  const f = d.form as Record<string, unknown> | undefined
  if (!f || !Array.isArray(f.lines)) return null
  const lines = f.lines.slice(0, 200).map(parseLine).filter((l): l is DocLine => l !== null)
  if (lines.length === 0) return null
  const gd = f.global_discount as Record<string, unknown> | null | undefined
  const form: DocForm = {
    client_id: str(f.client_id, 64),
    issue_date: str(f.issue_date, 10),
    due_date: str(f.due_date, 10),
    valid_until: str(f.valid_until, 10),
    delivery_date: str(f.delivery_date, 10),
    reference: str(f.reference, 200),
    notes: str(f.notes),
    lines,
    autoliquidation: f.autoliquidation === true,
    global_discount: gd && typeof gd === "object"
      ? { kind: gd.kind === "eur" ? "eur" : "pct", value: str(gd.value, 32), label: str(gd.label, 200) || "Remise commerciale" }
      : null,
  }
  return { savedAt, form }
}

export function readLocalDraft(kind: DocKind, owner: string): LocalDraft | null {
  try {
    return parseLocalDraft(window.localStorage.getItem(localDraftKey(kind, owner)))
  } catch {
    return null
  }
}

export function writeLocalDraft(kind: DocKind, owner: string, form: DocForm, now = Date.now()): void {
  try {
    window.localStorage.setItem(localDraftKey(kind, owner), JSON.stringify({ savedAt: now, form }))
  } catch {
    /* stockage plein ou bloqué : la copie locale est un filet, pas une obligation */
  }
}

export function clearLocalDraft(kind: DocKind, owner: string): void {
  try { window.localStorage.removeItem(localDraftKey(kind, owner)) } catch { /* idem */ }
}

/** Déconnexion : aucune saisie d'un compte ne reste sur un appareil partagé. */
export function clearAllLocalDrafts(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => window.localStorage.removeItem(k))
  } catch { /* idem */ }
}
