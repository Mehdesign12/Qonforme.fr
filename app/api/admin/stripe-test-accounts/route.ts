/**
 * GET    /api/admin/stripe-test-accounts            liste des comptes d'essai
 * POST   /api/admin/stripe-test-accounts  { email } ajoute un compte d'essai
 * DELETE /api/admin/stripe-test-accounts?userId=…   le retire (et efface son abonnement d'essai)
 *
 * Admin seulement. Un compte d'essai paie dans le bac à sable Stripe ; tous les
 * autres restent en production (lib/stripe/mode.ts).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-require'
import { addTestAccount, listTestAccounts, removeTestAccount } from '@/lib/stripe/test-accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function denied() {
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return denied()
  const result = await listTestAccounts()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ accounts: result.data })
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return denied()
  const body = await request.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email : ''
  const result = await addTestAccount(email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ account: result.data })
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return denied()
  const userId = request.nextUrl.searchParams.get('userId') ?? ''
  if (!UUID.test(userId)) return NextResponse.json({ error: 'Compte invalide.' }, { status: 400 })
  const result = await removeTestAccount(userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}
