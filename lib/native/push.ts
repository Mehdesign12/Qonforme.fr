import { isNativeApp, getPlatform } from './platform'

/**
 * Notifications push natives — relances de factures impayées.
 *
 * C'est la capacité qui distingue vraiment l'app de la version web : Safari iOS
 * ne délivre pas de push fiable à une PWA. Le jeton APNs est envoyé à
 * `/api/native/push-token`, où il est rattaché au compte connecté.
 */

/** Clé Preferences conservant le jeton, pour pouvoir le révoquer à la déconnexion. */
const TOKEN_STORAGE_KEY = 'qonforme.push-token'

/** Reçoit le chemin interne à ouvrir quand l'utilisateur touche une notification. */
export type PushOpenHandler = (path: string) => void

async function readStoredToken(): Promise<string | null> {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: TOKEN_STORAGE_KEY })
    return value
  } catch {
    return null
  }
}

async function storeToken(token: string | null): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    if (token === null) {
      await Preferences.remove({ key: TOKEN_STORAGE_KEY })
    } else {
      await Preferences.set({ key: TOKEN_STORAGE_KEY, value: token })
    }
  } catch {
    // Stockage natif indisponible : le jeton sera simplement réenregistré au prochain lancement.
  }
}

/** Transmet le jeton au serveur pour le rattacher au compte connecté. */
async function sendTokenToServer(token: string): Promise<void> {
  let appVersion: string | undefined

  try {
    const { App } = await import('@capacitor/app')
    appVersion = (await App.getInfo()).version
  } catch {
    // `getInfo` n'existe pas sur le web ; sans conséquence, le champ est optionnel.
  }

  const response = await fetch('/api/native/push-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Les cookies de session Supabase authentifient l'appel.
    credentials: 'include',
    body: JSON.stringify({ token, platform: getPlatform(), appVersion }),
  })

  if (!response.ok) {
    throw new Error(`Enregistrement du jeton refusé (${response.status})`)
  }
}

/**
 * Demande l'autorisation, enregistre l'appareil et branche les écoutes.
 *
 * À n'appeler qu'une fois l'utilisateur connecté : sans session, le serveur
 * rejetterait le jeton et iOS aurait consommé la demande d'autorisation — qu'un
 * refus rend définitive jusqu'à un passage manuel dans les Réglages.
 */
export async function initPushNotifications(onOpen: PushOpenHandler): Promise<void> {
  if (!isNativeApp()) return

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const status = await PushNotifications.checkPermissions()
    const granted =
      status.receive === 'granted'
        ? true
        : (await PushNotifications.requestPermissions()).receive === 'granted'

    if (!granted) return

    // Les écoutes doivent être posées avant `register()` : le jeton peut
    // arriver dès l'appel suivant.
    await PushNotifications.addListener('registration', async ({ value }) => {
      try {
        await sendTokenToServer(value)
        await storeToken(value)
      } catch (error) {
        console.error('[push] Jeton non enregistré côté serveur', error)
      }
    })

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[push] APNs a refusé l’enregistrement', error)
    })

    // Notification touchée alors que l'app est fermée ou en arrière-plan.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const path = action.notification.data?.path
      // On n'accepte qu'un chemin interne : une URL absolue venant du payload
      // pourrait rediriger l'app vers un site tiers.
      if (typeof path === 'string' && path.startsWith('/')) onOpen(path)
    })

    await PushNotifications.register()
  } catch (error) {
    console.error('[push] Initialisation impossible', error)
  }
}

/**
 * Révoque le jeton de cet appareil.
 *
 * Indispensable à la déconnexion : sans cela, les relances du compte précédent
 * continueraient d'arriver sur le téléphone.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!isNativeApp()) return

  const token = await readStoredToken()
  if (!token) return

  try {
    await fetch('/api/native/push-token', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
  } catch {
    // Hors connexion : le jeton sera purgé côté serveur quand APNs le signalera invalide.
  }

  await storeToken(null)
}
