/**
 * Une facture reçue.
 *
 * GET    : fiche et historique du cycle de vie.
 * PATCH  : statut posé par l'artisan (approuver, refuser avec motif, litige,
 *          paiement transmis…). Liste blanche de lib/reception/lifecycle.ts,
 *          appliquée ici : l'interface ne fait que proposer. Le statut est
 *          transmis à la plateforme agréée seulement si une plateforme est
 *          raccordée ET que la facture est arrivée par elle ; sinon il reste
 *          dans Qonforme (transmitted_at null).
 * DELETE : retrait d'une facture importée par erreur, tant qu'aucune décision
 *          n'a été prise (statut « Reçue »). Une facture arrivée par la
 *          plateforme ne se supprime pas.
 */
import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { getPlatformAdapter } from "@/lib/pa"
import {
  canTransition, effectiveReasonCode, isReceivedStatus, STATUS_DEFS, validateStatusChange,
} from "@/lib/reception/lifecycle"
import {
  DETAIL_COLUMNS, EVENTS_TABLE, RECEIVED_BUCKET, RECEIVED_TABLE, isReceptionUnavailable, toDetail,
} from "@/lib/reception/server"

export const dynamic = "force-dynamic"

interface Params { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadDetail(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: string) {
  const { data, error } = await supabase
    .from(RECEIVED_TABLE)
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) return { error }
  if (!data) return { notFound: true as const }
  const events = await supabase
    .from(EVENTS_TABLE)
    .select("id, status, code, reason_code, reason, actor, transmitted_at, created_at")
    .eq("invoice_id", id)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
  return { row: data as Record<string, unknown>, events: (events.data ?? []) as Record<string, unknown>[] }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const res = await loadDetail(supabase, user.id, id)
  if ("error" in res && res.error) {
    if (isReceptionUnavailable(res.error)) return NextResponse.json({ error: "La réception des factures n'est pas encore activée.", code: "RECEPTION_UNAVAILABLE" }, { status: 503 })
    return NextResponse.json({ error: "Impossible de charger la facture." }, { status: 500 })
  }
  if ("notFound" in res) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  return NextResponse.json({ invoice: toDetail(res.row!, res.events!) })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json().catch(() => null) as { status?: unknown; reason_code?: unknown; reason?: unknown } | null
  if (!body || !isReceivedStatus(body.status)) return NextResponse.json({ error: "Statut inconnu." }, { status: 400 })
  const to = body.status
  const reasonCode = typeof body.reason_code === "string" && body.reason_code ? body.reason_code : null
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) || null : null

  const { data: current, error } = await supabase
    .from(RECEIVED_TABLE)
    .select("id, status, platform_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) {
    if (isReceptionUnavailable(error)) return NextResponse.json({ error: "La réception des factures n'est pas encore activée." }, { status: 503 })
    return NextResponse.json({ error: "Impossible de mettre à jour la facture." }, { status: 500 })
  }
  if (!current) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  const from = isReceivedStatus(current.status) ? current.status : "received"
  if (!canTransition(from, to)) {
    return NextResponse.json(
      { error: `Une facture « ${STATUS_DEFS[from].label} » ne peut pas passer à « ${STATUS_DEFS[to].label} ».` },
      { status: 403 },
    )
  }
  const invalid = validateStatusChange(to, reasonCode, reason)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 })

  const now = new Date().toISOString()
  const code = effectiveReasonCode(to, reasonCode)
  // Mise à jour conditionnelle : si le statut a changé entre-temps, rien n'est écrit
  const upd = await supabase
    .from(RECEIVED_TABLE)
    .update({ status: to, status_reason_code: code, status_reason: reason, status_changed_at: now, updated_at: now })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", from)
    .select("id")
  if (upd.error) return NextResponse.json({ error: "Impossible de mettre à jour la facture." }, { status: 500 })
  if (!upd.data?.length) return NextResponse.json({ error: "La facture a changé entre-temps. Rechargez la page." }, { status: 409 })

  const ev = await supabase
    .from(EVENTS_TABLE)
    .insert({ invoice_id: id, user_id: user.id, status: to, code: STATUS_DEFS[to].code, reason_code: code, reason, actor: "user", created_at: now })
    .select("id")
    .single()
  if (ev.error) console.error("[received-invoices] historique:", ev.error.message)

  // Transmission à la plateforme agréée : seulement si elle est raccordée et connaît la facture
  const adapter = getPlatformAdapter()
  const platformId = typeof current.platform_id === "string" ? current.platform_id : null
  if (adapter.connected && platformId && ev.data) {
    try {
      const sent = await adapter.sendStatus({ platformId, status: to, code: STATUS_DEFS[to].code, reasonCode: code, reason, at: now })
      if (sent.transmitted) {
        // L'historique est en ajout seul pour l'utilisateur (RLS) : la date de transmission est écrite par le serveur
        await createAdminClient().from(EVENTS_TABLE).update({ transmitted_at: new Date().toISOString() }).eq("id", ev.data.id).eq("user_id", user.id)
      }
    } catch (e) {
      console.error("[received-invoices] transmission du statut:", e instanceof Error ? e.message : e)
    }
  }

  const res = await loadDetail(supabase, user.id, id)
  if (!("row" in res) || !res.row) return NextResponse.json({ ok: true })
  return NextResponse.json({ invoice: toDetail(res.row, res.events ?? []) })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { data: row, error } = await supabase
    .from(RECEIVED_TABLE)
    .select("id, status, source, file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Impossible de retirer la facture." }, { status: isReceptionUnavailable(error) ? 503 : 500 })
  if (!row) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
  if (row.source !== "import" || row.status !== "received") {
    return NextResponse.json(
      { error: "Seule une facture importée, sans décision enregistrée, peut être retirée. Sinon, refusez-la avec un motif." },
      { status: 403 },
    )
  }

  const del = await supabase.from(RECEIVED_TABLE).delete().eq("id", id).eq("user_id", user.id).eq("status", "received").select("id")
  if (del.error) return NextResponse.json({ error: "Impossible de retirer la facture." }, { status: 500 })
  if (!del.data?.length) return NextResponse.json({ error: "La facture a changé entre-temps. Rechargez la page." }, { status: 409 })
  // Le fichier n'appartient qu'à cette facture : on le retire aussi (dossier de l'utilisateur seulement)
  if (typeof row.file_path === "string" && row.file_path.startsWith(`${user.id}/`)) {
    await supabase.storage.from(RECEIVED_BUCKET).remove([row.file_path])
  }
  return NextResponse.json({ ok: true })
}
