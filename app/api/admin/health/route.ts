/**
 * GET /api/admin/health
 *
 * Endpoint de santé système — réservé à l'admin.
 * Vérifie l'état de Supabase, Stripe et Resend en temps réel,
 * et retourne les dernières exécutions du cron + stats utilisateurs.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminAuthenticated } from "@/lib/admin-require"
import Stripe from "stripe"

export const dynamic = "force-dynamic"

async function pingSupabase(admin: ReturnType<typeof createAdminClient>) {
  const t0 = Date.now()
  try {
    const { error } = await admin.from("cron_logs").select("id", { head: true, count: "exact" })
    return { status: error ? "error" : "ok", latencyMs: Date.now() - t0, error: error?.message }
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t0, error: String(e) }
  }
}

async function pingStripe() {
  const t0 = Date.now()
  try {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { status: "error", latencyMs: 0, error: "STRIPE_SECRET_KEY manquant" }
    const stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" })
    await stripe.balance.retrieve()
    return { status: "ok", latencyMs: Date.now() - t0 }
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t0, error: String(e) }
  }
}

async function pingResend() {
  const t0 = Date.now()
  try {
    const key = process.env.RESEND_API_KEY
    if (!key) return { status: "error", latencyMs: 0, error: "RESEND_API_KEY manquant" }
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { status: "ok", latencyMs: Date.now() - t0 }
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t0, error: String(e) }
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const admin = createAdminClient()

  const [supabase, stripe, resend] = await Promise.all([
    pingSupabase(admin),
    pingStripe(),
    pingResend(),
  ])

  // ── Derniers runs du cron ────────────────────────────────────────────────
  const { data: cronLogs } = await admin
    .from("cron_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)

  // ── Stats utilisateurs ────────────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [usersRes, newUsersRes, activeSubsRes] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1 }),
    admin.from("companies").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ])

  const totalUsers = (usersRes.data as { total?: number } | null)?.total
    ?? (usersRes.data as { users?: unknown[] } | null)?.users?.length
    ?? 0

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    services: { supabase, stripe, resend },
    cron: {
      lastLogs: cronLogs ?? [],
    },
    users: {
      total: totalUsers,
      newThisWeek: newUsersRes.count ?? 0,
      activeSubscriptions: activeSubsRes.count ?? 0,
    },
  })
}
