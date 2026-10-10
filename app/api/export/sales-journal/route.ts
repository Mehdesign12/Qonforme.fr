/**
 * GET /api/export/sales-journal?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Journal des ventes (CSV) : factures (hors brouillons et annulées) et avoirs
 * de la période, TVA ventilée par taux. Même périmètre que l'export FEC.
 * Fichier : journal-des-ventes_{from}_{to}.csv
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSalesJournal } from '@/lib/export/sales-journal'
import type { FecCreditNote, FecInvoice } from '@/lib/export/fec'
import type { InvoiceLine } from '@/types'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') ?? ''
    const to   = searchParams.get('to') ?? ''
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ error: 'Période invalide : dates au format AAAA-MM-JJ attendues' }, { status: 400 })
    }
    if (from > to) return NextResponse.json({ error: 'La date de début doit précéder la date de fin' }, { status: 400 })

    const [inv, cn] = await Promise.all([
      supabase
        .from('invoices')
        .select('invoice_number, issue_date, lines, subtotal_ht, total_vat, total_ttc, status, client:clients(id, name, siren)')
        .eq('user_id', user.id)
        .gte('issue_date', from)
        .lte('issue_date', to)
        .neq('status', 'draft')
        .neq('status', 'cancelled'),
      supabase
        .from('credit_notes')
        .select('credit_note_number, issue_date, lines, subtotal_ht, total_vat, total_ttc, client:clients(id, name, siren)')
        .eq('user_id', user.id)
        .gte('issue_date', from)
        .lte('issue_date', to),
    ])
    if (inv.error || cn.error) {
      console.error('[journal des ventes]', inv.error || cn.error)
      return NextResponse.json({ error: 'Erreur lors de la récupération des factures' }, { status: 500 })
    }

    const invoices: FecInvoice[] = (inv.data ?? []).map((i) => ({
      invoice_number: i.invoice_number,
      issue_date:     i.issue_date,
      lines:          (i.lines as unknown as InvoiceLine[]) ?? [],
      subtotal_ht:    i.subtotal_ht,
      total_vat:      i.total_vat,
      total_ttc:      i.total_ttc,
      status:         i.status,
      client:         one(i.client),
    }))
    const creditNotes: FecCreditNote[] = (cn.data ?? []).map((c) => ({
      credit_note_number: c.credit_note_number,
      issue_date:         c.issue_date,
      lines:              (c.lines as unknown as InvoiceLine[]) ?? [],
      subtotal_ht:        c.subtotal_ht,
      total_vat:          c.total_vat,
      total_ttc:          c.total_ttc,
      client:             one(c.client),
    }))

    return new NextResponse(generateSalesJournal({ invoices, creditNotes }), {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="journal-des-ventes_${from}_${to}.csv"`,
        'Cache-Control':       'no-store, no-cache',
      },
    })
  } catch (err) {
    console.error('[journal des ventes] Erreur inattendue:', err)
    return NextResponse.json({ error: 'Erreur inattendue, réessayez dans un instant' }, { status: 500 })
  }
}
