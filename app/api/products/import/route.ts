import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isTradeId } from "@/lib/legal/profile"
import { buildImportRows, type VatContext } from "@/lib/catalogue/trades"

const CONTEXTS = new Set<VatContext>(["renovation", "standard", "franchise"])
const MAX_ITEMS = 50
const MAX_PRICE = 1_000_000

/**
 * POST /api/products/import — ajoute au catalogue les prestations courantes
 * d'un métier, cochées par l'artisan (lib/catalogue/trades.ts).
 *
 * Corps : { trade, context, items: [{ id, unit_price_ht? }] }. Désignation,
 * unité et taux de TVA viennent de la liste du métier, jamais de la requête ;
 * le prix est celui saisi, sinon 0 € (« Prix à compléter »). Une prestation
 * déjà au catalogue (même désignation) n'est pas recréée.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const trade = body?.trade
  const context = body?.context
  const items = Array.isArray(body?.items) ? body.items : null

  if (!isTradeId(trade)) return NextResponse.json({ error: "Métier inconnu" }, { status: 400 })
  if (typeof context !== "string" || !CONTEXTS.has(context as VatContext)) {
    return NextResponse.json({ error: "Type de chantier inconnu" }, { status: 400 })
  }
  if (!items || items.length === 0) return NextResponse.json({ error: "Cochez au moins une prestation" }, { status: 400 })
  if (items.length > MAX_ITEMS) return NextResponse.json({ error: "Trop de prestations" }, { status: 400 })

  const choices: { id: string; unit_price_ht: number | null }[] = []
  for (const it of items) {
    if (!it || typeof it.id !== "string") return NextResponse.json({ error: "Prestation invalide" }, { status: 400 })
    const raw = it.unit_price_ht
    if (raw !== undefined && raw !== null && (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > MAX_PRICE)) {
      return NextResponse.json({ error: "Prix invalide" }, { status: 400 })
    }
    choices.push({ id: it.id, unit_price_ht: typeof raw === "number" ? raw : null })
  }

  // Désignations déjà au catalogue (actives ou non) : pas de doublon
  const { data: existing, error: readErr } = await supabase
    .from("products")
    .select("name")
    .eq("user_id", user.id)
  if (readErr) return NextResponse.json({ error: "Le catalogue n'a pas pu être lu. Réessayez." }, { status: 500 })

  const { rows, skipped } = buildImportRows({
    trade,
    context: context as VatContext,
    items: choices,
    existingNames: (existing ?? []).map((p: { name: string }) => p.name),
  })

  if (rows.length === 0) {
    return NextResponse.json({ created: 0, skipped: skipped.length, products: [] })
  }

  const { data, error } = await supabase
    .from("products")
    .insert(rows.map((r) => ({
      user_id: user.id,
      name: r.name,
      description: null,
      unit_price_ht: r.unit_price_ht,
      vat_rate: r.vat_rate,
      unit: r.unit,
      reference: null,
      is_active: true,
    })))
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: data?.length ?? rows.length, skipped: skipped.length, products: data ?? [] }, { status: 201 })
}
