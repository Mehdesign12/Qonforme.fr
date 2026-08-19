import { createSign } from "node:crypto"
import http2 from "node:http2"

/**
 * Client APNs (Apple Push Notification service) — connexion HTTP/2 signée
 * par un jeton JWT (clé .p8, auth "token-based" recommandée par Apple).
 *
 * Aucune dépendance ajoutée : `node:http2` (APNs n'accepte QUE du HTTP/2, pas
 * de HTTP/1.1) et `node:crypto` pour la signature ES256 suffisent.
 *
 * Configuration requise (variables d'environnement) :
 *   APNS_KEY_ID      — Key ID de la clé .p8 créée dans Apple Developer
 *   APNS_TEAM_ID     — Team ID du compte Apple Developer
 *   APNS_PRIVATE_KEY — contenu PEM du fichier .p8 (retours à la ligne réels
 *                      OU échappés en "\n" — les deux formes sont acceptées)
 *   APNS_ENVIRONMENT — "production" (défaut) ou "sandbox". Un build lancé
 *                      depuis Xcode en Debug (comme lors des tests sur iPhone
 *                      physique) reçoit un jeton APNs *sandbox* ; un build
 *                      TestFlight/App Store reçoit un jeton *production*.
 *                      Sans certitude sur l'environnement d'un jeton donné,
 *                      `send()` retente automatiquement sur l'autre serveur
 *                      en cas de `BadDeviceToken` — inutile de jongler avec
 *                      cette variable en permanence pendant les tests.
 *
 * Tant que ces variables ne sont pas définies, `openApnsClient()` retourne
 * `null` et logue un avertissement une fois — les emails de relance (canal
 * principal) continuent de fonctionner normalement, sans aucun risque de
 * régression le temps que la clé APNs soit créée côté Apple Developer.
 */

// Doit rester synchronisé avec `appId` dans capacitor.config.ts.
const DEFAULT_BUNDLE_ID = "fr.qonforme.app"

const APNS_PRODUCTION_HOST = "api.push.apple.com"
const APNS_SANDBOX_HOST = "api.sandbox.push.apple.com"

/** Durée de vie du JWT APNs avant renouvellement. Apple l'accepte jusqu'à 1h ;
 *  on renouvelle un peu avant pour ne jamais présenter un jeton expiré. */
const JWT_TTL_MS = 50 * 60 * 1000

export interface ApnsPushPayload {
  title: string
  body: string
  /** Chemin interne ouvert au tap sur la notification — voir NativeAppInit.tsx. */
  path?: string
  badge?: number
  sound?: string
}

export interface ApnsSendResult {
  token: string
  ok: boolean
  status: number
  reason?: string
  /** Apple indique que ce jeton n'est plus valide sur aucun environnement — à retirer de push_tokens. */
  shouldRemove: boolean
}

export interface ApnsClient {
  send(deviceToken: string, payload: ApnsPushPayload): Promise<ApnsSendResult>
  close(): void
}

interface ApnsConfig {
  keyId: string
  teamId: string
  privateKey: string
  bundleId: string
  production: boolean
}

function readApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const rawKey = process.env.APNS_PRIVATE_KEY

  if (!keyId || !teamId || !rawKey) {
    console.warn(
      "[apns] APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY manquants — " +
      "notifications push ignorées (les emails de relance continuent normalement).",
    )
    return null
  }

  // Un PEM collé dans une variable d'environnement perd souvent ses vrais
  // retours à la ligne : on accepte la forme échappée "\n" en plus du PEM brut.
  const privateKey = rawKey.includes("\n") ? rawKey : rawKey.replace(/\\n/g, "\n")

  return {
    keyId,
    teamId,
    privateKey,
    bundleId: process.env.APNS_BUNDLE_ID || DEFAULT_BUNDLE_ID,
    production: (process.env.APNS_ENVIRONMENT ?? "production") !== "sandbox",
  }
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Signe un JWT ES256 pour l'auth "token-based" d'APNs (une clé .p8 sert pour
 * toute l'app, pas par device). Exportée pour le test unitaire
 * `__tests__/apns-jwt.test.ts`, qui vérifie que la signature produite est
 * authentifiable — le seul moyen de détecter une erreur d'encodage sans
 * attendre un vrai aller-retour (raté) avec les serveurs Apple.
 */
export function signApnsJwt(config: Pick<ApnsConfig, "keyId" | "teamId" | "privateKey">): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }))
  const payload = base64url(JSON.stringify({ iss: config.teamId, iat: Math.floor(Date.now() / 1000) }))
  const signingInput = `${header}.${payload}`

  const signer = createSign("SHA256")
  signer.update(signingInput)
  signer.end()
  // Un JWT attend une signature ECDSA "raw" (r||s) — le format DER par défaut
  // de `crypto.sign` ne serait pas accepté par APNs.
  const signature = signer.sign({ key: config.privateKey, dsaEncoding: "ieee-p1363" })

  return `${signingInput}.${base64url(signature)}`
}

function postOnce(
  conn: http2.ClientHttp2Session,
  deviceToken: string,
  jwt: string,
  bundleId: string,
  payload: ApnsPushPayload,
): Promise<{ ok: boolean; status: number; reason?: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: payload.sound ?? "default",
        ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      },
      ...(payload.path ? { path: payload.path } : {}),
    })

    let req: http2.ClientHttp2Stream
    try {
      req = conn.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      })
    } catch (err) {
      reject(err)
      return
    }

    let status = 0
    let responseBody = ""

    req.on("response", (headers) => {
      status = Number(headers[":status"])
    })
    req.setEncoding("utf8")
    req.on("data", (chunk) => { responseBody += chunk })
    req.on("end", () => {
      if (status === 200) {
        resolve({ ok: true, status })
        return
      }
      let reason: string | undefined
      try { reason = JSON.parse(responseBody).reason } catch { /* corps vide ou non-JSON */ }
      resolve({ ok: false, status, reason })
    })
    req.on("error", reject)

    req.write(body)
    req.end()
  })
}

/**
 * Ouvre une connexion (réutilisable) vers APNs. À ouvrir UNE FOIS par lot
 * d'envois (ex: tout un run de cron) et fermer à la fin — Apple traite une
 * reconnexion par notification comme un usage abusif.
 *
 * Retourne `null` si la config APNs n'est pas encore définie (voir en tête
 * de fichier) : l'appelant doit alors simplement sauter l'envoi push.
 */
export function openApnsClient(): ApnsClient | null {
  const config = readApnsConfig()
  if (!config) return null

  const primaryHost = config.production ? APNS_PRODUCTION_HOST : APNS_SANDBOX_HOST
  const fallbackHost = config.production ? APNS_SANDBOX_HOST : APNS_PRODUCTION_HOST

  let primaryConn: http2.ClientHttp2Session | null = null
  let fallbackConn: http2.ClientHttp2Session | null = null
  let cachedJwt: { value: string; expiresAt: number } | null = null

  function getJwt(): string {
    const now = Date.now()
    if (cachedJwt && cachedJwt.expiresAt > now) return cachedJwt.value
    const value = signApnsJwt(config!)
    cachedJwt = { value, expiresAt: now + JWT_TTL_MS }
    return value
  }

  function getConn(host: string): http2.ClientHttp2Session {
    const isPrimary = host === primaryHost
    const existing = isPrimary ? primaryConn : fallbackConn

    if (existing && !existing.closed && !existing.destroyed) return existing

    const conn = http2.connect(`https://${host}`)
    // Une connexion qui tombe (timeout, réseau) ne doit pas planter le process —
    // le prochain `send()` en rouvrira simplement une nouvelle.
    conn.on("error", () => { /* voir nettoyage sur 'close' ci-dessous */ })
    conn.on("close", () => {
      if (isPrimary) primaryConn = null
      else fallbackConn = null
    })

    if (isPrimary) primaryConn = conn
    else fallbackConn = conn
    return conn
  }

  async function send(deviceToken: string, payload: ApnsPushPayload): Promise<ApnsSendResult> {
    const jwt = getJwt()

    let result: { ok: boolean; status: number; reason?: string }
    try {
      result = await postOnce(getConn(primaryHost), deviceToken, jwt, config!.bundleId, payload)
    } catch (err) {
      console.error(`[apns] Échec connexion (${primaryHost}) :`, err)
      return { token: deviceToken, ok: false, status: 0, shouldRemove: false }
    }

    // BadDeviceToken sur le serveur attendu = très probablement un jeton de
    // l'AUTRE environnement (dev vs prod) — un seul essai de repli avant de
    // considérer le jeton réellement invalide.
    if (!result.ok && result.reason === "BadDeviceToken") {
      try {
        result = await postOnce(getConn(fallbackHost), deviceToken, jwt, config!.bundleId, payload)
      } catch (err) {
        console.error(`[apns] Échec connexion de repli (${fallbackHost}) :`, err)
      }
    }

    const shouldRemove = result.status === 410 || result.reason === "Unregistered" || result.reason === "BadDeviceToken"
    if (!result.ok && !shouldRemove) {
      console.error(`[apns] Envoi refusé (status ${result.status}${result.reason ? `, ${result.reason}` : ""})`)
    }

    return { token: deviceToken, ok: result.ok, status: result.status, reason: result.reason, shouldRemove }
  }

  function close() {
    primaryConn?.close()
    fallbackConn?.close()
  }

  return { send, close }
}
