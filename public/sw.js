/* eslint-disable no-restricted-globals */
/**
 * Service worker Qonforme — support hors-ligne de la PWA iOS/Android.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RÈGLE DE SÉCURITÉ — ne jamais mettre de données utilisateur en cache
 * ─────────────────────────────────────────────────────────────────────────────
 * Le Cache Storage est persistant et partagé par toutes les sessions d'un même
 * navigateur. Mettre en cache le HTML d'une route authentifiée exposerait les
 * factures d'un utilisateur à la personne suivante sur le même appareil, et
 * afficherait des données périmées après déconnexion.
 *
 * Sont donc mis en cache UNIQUEMENT :
 *   - les assets immuables (`/_next/static`, polices, icônes, splash screens) ;
 *   - le HTML des pages 100 % publiques (celles que le middleware laisse passer
 *     sans appel Supabase — voir `lib/supabase/middleware.ts`).
 *
 * Ne sont JAMAIS mis en cache :
 *   - `/api/*` (y compris les webhooks et les PDF générés) ;
 *   - toute route protégée (`/dashboard`, `/invoices`, `/clients`, …) ;
 *   - `/`, `/login`, `/signup`, … : publiques mais dont la réponse dépend de
 *     l'état de connexion (le middleware redirige les utilisateurs connectés).
 */

const VERSION = 'v1'
const STATIC_CACHE = `qonforme-static-${VERSION}`
const PAGES_CACHE = `qonforme-pages-${VERSION}`
const IMAGES_CACHE = `qonforme-images-${VERSION}`
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE]

const OFFLINE_URL = '/offline.html'

/** Ressources indispensables pour afficher quelque chose sans réseau. */
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
]

/**
 * Préfixes dont le HTML peut être mis en cache : le middleware y répond sans
 * consulter Supabase, la réponse est donc identique pour tous les visiteurs.
 * Doit rester aligné sur `purePublicPaths` dans `lib/supabase/middleware.ts`.
 */
const CACHEABLE_PAGE_PREFIXES = [
  '/blog',
  '/cgu',
  '/mentions-legales',
  '/confidentialite',
  '/facturation',
  '/guide',
  '/modele',
  '/comparatif',
  '/glossaire',
  '/pricing',
  '/demo',
  '/outils',
]

/** Nombre maximum de pages publiques conservées, pour borner le stockage. */
const MAX_CACHED_PAGES = 60
/** Idem pour les images optimisées par Next. */
const MAX_CACHED_IMAGES = 80

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const isCacheablePage = (pathname) =>
  CACHEABLE_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

/** Assets à empreinte ou strictement statiques → sûrs en cache-first. */
const isStaticAsset = (pathname) =>
  pathname.startsWith('/_next/static/') ||
  pathname.startsWith('/fonts/') ||
  pathname.startsWith('/icons/') ||
  pathname.startsWith('/splash/') ||
  /\.(?:css|js|woff2?|ttf|otf|svg|ico)$/.test(pathname)

const isImage = (pathname) =>
  pathname.startsWith('/_next/image') || /\.(?:png|jpe?g|gif|webp|avif)$/.test(pathname)

/**
 * Une réponse n'est stockable que si elle est complète, non redirigée et
 * issue de notre origine. `basic` exclut les réponses opaques (CDN tiers).
 */
const isStorable = (response) =>
  response &&
  response.status === 200 &&
  response.type === 'basic' &&
  !response.redirected

/** Éviction FIFO simple : le Cache Storage n'a pas de politique de taille. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)))
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Cycle de vie                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // `reload` court-circuite le cache HTTP : on précache la version réelle.
      cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith('qonforme-') && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  const type = event.data?.type

  // Déclenché par <ServiceWorkerRegister /> quand l'utilisateur accepte la mise à jour.
  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  // Déclenché à la déconnexion : purge tout HTML éventuellement conservé.
  if (type === 'PURGE_PAGES') {
    event.waitUntil(caches.delete(PAGES_CACHE))
  }
})

/* ────────────────────────────────────────────────────────────────────────── */
/* Stratégies de récupération                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** Navigation : réseau d'abord, cache public en secours, page hors-ligne en dernier. */
async function handleNavigation(request) {
  const url = new URL(request.url)

  try {
    const response = await fetch(request)

    if (isCacheablePage(url.pathname) && isStorable(response)) {
      const cache = await caches.open(PAGES_CACHE)
      await cache.put(request, response.clone())
      trimCache(PAGES_CACHE, MAX_CACHED_PAGES)
    }

    return response
  } catch {
    // Hors-ligne : seules les pages publiques ont pu être mises en cache.
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return cached

    const offline = await caches.match(OFFLINE_URL)
    if (offline) return offline

    return new Response('Hors connexion', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

/** Assets immuables : cache d'abord, réseau en secours. */
async function handleStaticAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (isStorable(response)) {
      const cache = await caches.open(STATIC_CACHE)
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    // Asset jamais mis en cache et réseau coupé. On rend une Response en échec
    // plutôt que de laisser la promesse rejeter : le comportement est identique
    // côté navigateur, mais aucune exception non gérée ne remonte du worker.
    return Response.error()
  }
}

/** Images : réponse immédiate depuis le cache, rafraîchissement en arrière-plan. */
async function handleImage(request) {
  /*
   * `caches.match` interroge TOUS les caches, pas seulement IMAGES_CACHE.
   * Indispensable : les icônes du manifest (`/web-app-manifest-192x192.png`,
   * affichée par offline.html) sont précachées dans STATIC_CACHE. Une recherche
   * limitée à IMAGES_CACHE les manquait, et la page hors-ligne s'affichait avec
   * un logo cassé — précisément quand le réseau ne peut pas rattraper l'erreur.
   */
  const cached = await caches.match(request)

  const network = fetch(request)
    .then(async (response) => {
      if (isStorable(response)) {
        const cache = await caches.open(IMAGES_CACHE)
        await cache.put(request, response.clone())
        trimCache(IMAGES_CACHE, MAX_CACHED_IMAGES)
      }
      return response
    })
    .catch(() => cached)

  // `respondWith()` résolu sur `undefined` produit une erreur réseau : on
  // garantit toujours une Response, quitte à ce qu'elle soit en échec.
  return (await (cached ?? network)) ?? Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Les requêtes non-GET modifient l'état : jamais interceptées.
  if (request.method !== 'GET') return

  // Requêtes partielles (lecture vidéo) : laissées au navigateur.
  if (request.headers.has('range')) return

  const url = new URL(request.url)

  // Origines tierces (Supabase, Stripe, PostHog, Sentry) : aucune interception.
  if (url.origin !== self.location.origin) return

  // Routes API : réponses authentifiées ou à effet de bord → toujours réseau.
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request))
    return
  }

  if (isImage(url.pathname)) {
    event.respondWith(handleImage(request))
  }
})
