/**
 * GET /api/export/fec?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Génère et retourne un fichier FEC (Fichier des Écritures Comptables)
 * pour la période demandée.
 *
 * Inclut : factures (tous statuts sauf draft/cancelled) + avoirs
 * Format  : texte UTF-8 avec BOM, séparateur tabulation, CRLF
 * Fichier : {SIREN}FEC{YYYYMMDD}.txt
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFec, type FecInvoice, type FecCreditNote } from '@/lib/export/fec'
import type { InvoiceLine } from '@/types'

export const dynamic = 'force-dynamic'

/** Regex de validation d'une date YYYY-MM-DD */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // ── Validation des paramètres ──────────────────────────────────────────
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') ?? ''
    const to   = searchParams.get('to')   ?? ''

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json(
        { error: 'Paramètres from et to requis au format YYYY-MM-DD (ex: 2026-01-01)' },
        { status: 400 },
      )
    }
    if (from > to) {
      return NextResponse.json(
        { error: 'La date de début (from) doit être antérieure ou égale à la date de fin (to)' },
        { status: 400 },
      )
    }

    // ── Entreprise — SIREN obligatoire pour le nom de fichier ─────────────
    const { data: company } = await supabase
      .from('companies')
      .select('siren, name')
      .eq('user_id', user.id)
      .single()

    if (!company?.siren) {
      return NextResponse.json(
        {
          error: 'SIREN manquant. Renseigne ton SIREN dans les paramètres de ton entreprise avant d\'exporter le FEC.',
          code: 'SIREN_MISSING',
        },
        { status: 400 },
      )
    }

    // ── Factures pour la période ───────────────────────────────────────────
    // Statuts exclus : draft (non validée), cancelled (annulée avant envoi)
    const { data: rawInvoices, error: invErr } = await supabase
      .from('invoices')
      .select(`
        invoice_number,
        issue_date,
        lines,
        subtotal_ht,
        total_vat,
        total_ttc,
        status,
        client:clients(id, name, siren)
      `)
      .eq('user_id', user.id)
      .gte('issue_date', from)
      .lte('issue_date', to)
      .neq('status', 'draft')
      .neq('status', 'cancelled')
      .order('issue_date', { ascending: true })
      .order('invoice_number', { ascending: true })

    if (invErr) {
      console.error('[FEC] Erreur récupération factures:', invErr)
      return NextResponse.json({ error: 'Erreur lors de la récupération des factures' }, { status: 500 })
    }

    // ── Avoirs pour la période ─────────────────────────────────────────────
    const { data: rawCreditNotes, error: cnErr } = await supabase
      .from('credit_notes')
      .select(`
        credit_note_number,
        issue_date,
        lines,
        subtotal_ht,
        total_vat,
        total_ttc,
        client:clients(id, name, siren)
      `)
      .eq('user_id', user.id)
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date', { ascending: true })
      .order('credit_note_number', { ascending: true })

    if (cnErr) {
      console.error('[FEC] Erreur récupération avoirs:', cnErr)
      return NextResponse.json({ error: 'Erreur lors de la récupération des avoirs' }, { status: 500 })
    }

    // ── Normalisation des types (JSONB → InvoiceLine[]) ────────────────────
    const invoices: FecInvoice[] = (rawInvoices ?? []).map(inv => ({
      invoice_number: inv.invoice_number,
      issue_date:     inv.issue_date,
      lines:          (inv.lines as unknown as InvoiceLine[]) ?? [],
      subtotal_ht:    inv.subtotal_ht,
      total_vat:      inv.total_vat,
      total_ttc:      inv.total_ttc,
      status:         inv.status,
      client:         Array.isArray(inv.client) ? inv.client[0] ?? null : (inv.client ?? null),
    }))

    const creditNotes: FecCreditNote[] = (rawCreditNotes ?? []).map(cn => ({
      credit_note_number: cn.credit_note_number,
      issue_date:         cn.issue_date,
      lines:              (cn.lines as unknown as InvoiceLine[]) ?? [],
      subtotal_ht:        cn.subtotal_ht,
      total_vat:          cn.total_vat,
      total_ttc:          cn.total_ttc,
      client:             Array.isArray(cn.client) ? cn.client[0] ?? null : (cn.client ?? null),
    }))

    // ── Génération du contenu FEC ──────────────────────────────────────────
    const content = generateFec({ invoices, creditNotes })

    // ── Nom de fichier : {SIREN}FEC{YYYYMMDD}.txt ─────────────────────────
    const sirenClean = company.siren.replace(/\s/g, '')
    const toCompact  = to.replace(/-/g, '')
    const filename   = `${sirenClean}FEC${toCompact}.txt`

    console.log(
      `[FEC] Export généré — user ${user.id} — ` +
      `${invoices.length} factures + ${creditNotes.length} avoirs — ` +
      `période ${from} → ${to} — fichier ${filename}`,
    )

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type':        'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store, no-cache',
      },
    })
  } catch (err) {
    console.error('[FEC] Erreur inattendue:', err)
    return NextResponse.json(
      { error: 'Erreur inattendue lors de la génération du FEC. Réessaie ou contacte le support.' },
      { status: 500 },
    )
  }
}
