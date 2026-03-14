import { NextRequest, NextResponse } from 'next/server'
import { signAdminSession, ADMIN_COOKIE } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body ?? {}

    const adminEmail    = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim()
    const adminPassword = process.env.ADMIN_PASSWORD ?? ''

    if (
      !email || !password ||
      email.toLowerCase().trim() !== adminEmail ||
      password !== adminPassword
    ) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
    }

    const secret = process.env.ADMIN_COOKIE_SECRET ?? ''
    if (!secret) {
      console.error('[admin/auth/login] ADMIN_COOKIE_SECRET non configuré')
      return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
    }

    const token = await signAdminSession(secret)

    const isProduction = process.env.NODE_ENV === 'production'

    const response = NextResponse.json({ ok: true })
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly:  true,
      sameSite:  'strict',
      path:      '/',
      maxAge:    60 * 60 * 24, // 24h
      secure:    isProduction,
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
