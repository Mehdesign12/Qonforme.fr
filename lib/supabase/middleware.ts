import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ──────────────────────────────────────────────────────────────
  // Routes publiques — toujours accessibles, sans vérification
  // ──────────────────────────────────────────────────────────────
  const publicPaths = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/demo',
    '/pricing',
    '/api/webhooks/stripe', // webhook Stripe : ne doit jamais être bloqué
  ]

  const isPublic = publicPaths.some((path) =>
    pathname === path || pathname.startsWith(path + '/')
  )

  if (isPublic) {
    // Si l'utilisateur est connecté et va sur /login ou /signup (pas /signup/company)
    // → le rediriger vers le dashboard ou la page de pricing
    const authOnlyPaths = ['/login', '/signup']
    const isAuthPage =
      authOnlyPaths.some((p) => pathname.startsWith(p)) &&
      !pathname.startsWith('/signup/company')

    if (isAuthPage && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // ──────────────────────────────────────────────────────────────
  // Routes admin — réservées aux administrateurs de la plateforme
  // ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // ──────────────────────────────────────────────────────────────
  // Routes protégées : l'utilisateur doit être connecté
  // ──────────────────────────────────────────────────────────────
  const protectedPaths = [
    '/dashboard',
    '/invoices',
    '/quotes',
    '/clients',
    '/settings',
    '/products',
    '/credit-notes',
    '/purchase-orders',
  ]

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ──────────────────────────────────────────────────────────────
  // Vérification de l'abonnement pour les routes protégées
  // ──────────────────────────────────────────────────────────────
  if (isProtected && user) {
    // /settings/billing est toujours accessible (pour régulariser)
    const billingExempt =
      pathname.startsWith('/settings/billing') ||
      pathname.startsWith('/api/stripe/')

    if (!billingExempt) {
      const { data: sub, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .single()

      // En cas d'erreur réseau/timeout, laisser passer plutôt que
      // de rediriger en boucle (surtout sur connexion mobile lente)
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = "no rows found" → pas d'abonnement (légitime)
        // Toute autre erreur = problème technique → on laisse passer
        return supabaseResponse
      }

      if (!sub) {
        // Pas d'abonnement → page de sélection de plan
        const url = request.nextUrl.clone()
        url.pathname = '/pricing'
        return NextResponse.redirect(url)
      }

      if (sub.status === 'past_due') {
        // Paiement raté → page de gestion d'abonnement pour corriger le moyen de paiement
        const url = request.nextUrl.clone()
        url.pathname = '/settings/billing'
        return NextResponse.redirect(url)
      }

      if (sub.status === 'canceled' || sub.status === 'incomplete') {
        // Abonnement annulé ou checkout incomplet → retour au choix de plan
        const url = request.nextUrl.clone()
        url.pathname = '/pricing'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
