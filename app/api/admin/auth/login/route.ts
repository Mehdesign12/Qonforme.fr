import { NextRequest, NextResponse } from 'next/server'
import { signAdminSession, ADMIN_COOKIE } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body ?? {}

    const adminEmail    = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim()
    const adminPassword = (process.env.ADMIN_PASSWORD ?? '').trim()
    const secret        = (process.env.ADMIN_COOKIE_SECRET ?? '').trim()

    // Log de diagnostic (visible dans Vercel Function Logs)
    if (!adminEmail) {
      console.error('[admin/login] ADMIN_EMAIL non configuré')
      return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
    }
    if (!adminPassword) {
      console.error('[admin/login] ADMIN_PASSWORD non configuré')
      return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
    }
    if (!secret) {
      console.error('[admin/login] ADMIN_COOKIE_SECRET non configuré')
      return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
    }

    const emailOk    = typeof email === 'string' && email.toLowerCase().trim() === adminEmail
    const passwordOk = typeof password === 'string' && password.trim() === adminPassword

    if (!emailOk || !passwordOk) {
      console.error('[admin/login] Échec auth — emailOk:', emailOk, '| passwordOk:', passwordOk)
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
    }

    const token = await signAdminSession(secret)

    const response = NextResponse.json({ ok: true })
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',   // 'lax' au lieu de 'strict' : fonctionne mieux après redirection
      path:     '/',
      maxAge:   60 * 60 * 24, // 24h
      secure:   process.env.NODE_ENV === 'production',
    })
    return response
  } catch (err) {
    console.error('[admin/login] Erreur inattendue:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
