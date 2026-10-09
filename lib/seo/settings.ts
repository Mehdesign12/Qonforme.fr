/**
 * Réglages de l'onglet SEO (table seo_settings, une ligne par section) :
 * lecture et écriture en base. Schémas, valeurs par défaut et validation dans
 * lib/seo/settings-schema.ts (pur, utilisable côté client), réexportés ici.
 *
 * Une section jamais enregistrée rend ses valeurs par défaut (« saved: false »),
 * ce n'est pas une erreur. Une lecture en échec lève SeoDbError (jamais les
 * valeurs par défaut à la place : un réglage illisible ne doit pas passer pour
 * « pas de réglage »).
 */
import { must, type SeoDb } from "@/lib/seo/db"
import { mergeWithDefaults, SETTINGS_DEFAULTS, SETTINGS_SCHEMAS, type SettingsKey, type SettingsValue } from "@/lib/seo/settings-schema"

export * from "@/lib/seo/settings-schema"

/* ------------------------------------------------------------------ */
/* Lecture et écriture                                                 */
/* ------------------------------------------------------------------ */

export interface StoredSettings<K extends SettingsKey> {
  value: SettingsValue<K>
  /** Faux : valeurs par défaut, jamais enregistrées. */
  saved: boolean
  updatedAt: string | null
}

export async function getSettings<K extends SettingsKey>(db: SeoDb, key: K): Promise<StoredSettings<K>> {
  const row = must(
    await db.from("seo_settings").select("value, updated_at").eq("key", key).maybeSingle(),
    `les réglages « ${key} »`,
  ) as { value: unknown; updated_at: string } | null
  if (!row) return { value: SETTINGS_DEFAULTS[key], saved: false, updatedAt: null }
  return { value: mergeWithDefaults(key, row.value), saved: true, updatedAt: row.updated_at }
}

/** Plusieurs sections en une lecture. */
export async function getAllSettings(db: SeoDb): Promise<{ [K in SettingsKey]: StoredSettings<K> }> {
  const rows = must(await db.from("seo_settings").select("key, value, updated_at"), "les réglages SEO") as {
    key: string
    value: unknown
    updated_at: string
  }[]
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const out = {} as { [K in SettingsKey]: StoredSettings<K> }
  for (const key of Object.keys(SETTINGS_SCHEMAS) as SettingsKey[]) {
    const row = byKey.get(key)
    ;(out as Record<string, unknown>)[key] = row
      ? { value: mergeWithDefaults(key, row.value), saved: true, updatedAt: row.updated_at }
      : { value: SETTINGS_DEFAULTS[key], saved: false, updatedAt: null }
  }
  return out
}

export async function saveSettings<K extends SettingsKey>(db: SeoDb, key: K, value: SettingsValue<K>): Promise<string> {
  const updatedAt = new Date().toISOString()
  must(
    await db.from("seo_settings").upsert({ key, value, updated_at: updatedAt }, { onConflict: "key" }),
    `l'enregistrement des réglages « ${key} »`,
  )
  return updatedAt
}
