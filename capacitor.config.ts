import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

/**
 * Configuration de la coquille iOS native.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi `server.url` et non un bundle statique
 * ─────────────────────────────────────────────────────────────────────────────
 * Qonforme s'appuie sur le middleware Supabase, des routes API et du rendu
 * serveur : `next build && next export` est impossible. L'app native charge donc
 * la version en ligne dans sa WKWebView, et les fonctions natives (notifications
 * push, feuille de partage iOS, appareil photo, retour haptique) sont exposées
 * au JS par les plugins Capacitor.
 *
 * En développement, pointer sur une machine locale :
 *   CAPACITOR_SERVER_URL=http://192.168.1.20:3000 npx cap sync ios
 * (`localhost` ne fonctionne pas depuis un iPhone physique — il faut l'IP du Mac.)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi /dashboard et non le domaine nu — et pourquoi via appStartPath
 * ─────────────────────────────────────────────────────────────────────────────
 * `https://qonforme.fr` tout court sert la landing page marketing : hero,
 * tarifs, blog, footer SEO — pensée pour Google et les visiteurs web, pas pour
 * quelqu'un qui vient d'installer l'app. `/dashboard` est une route protégée :
 * le middleware s'occupe de tout renvoyer au bon endroit sans qu'on ait à
 * dupliquer cette logique ici — utilisateur connecté → tableau de bord direct,
 * non connecté → /login.
 *
 * Le chemin de départ ne doit JAMAIS être collé dans `server.url` lui-même
 * (`.../dashboard`) — piège réel, reproduit en test sur simulateur. Capacitor
 * réutilise `server.url`, chaîne pour chaîne, comme préfixe pour décider si
 * une navigation reste « dans l'app » :
 *   WebViewDelegationHandler.swift → isApplicationNavigation =
 *     navURL.absoluteString.starts(with: bridge.config.serverURL.absoluteString)
 *   → si faux et navigation de premier niveau : UIApplication.shared.open(navURL)
 *     (éjecte vers Safari) au lieu de charger dans la WKWebView.
 * Avec `server.url = ".../dashboard"`, la redirection du middleware vers
 * `/login` (chemin différent) échouait ce préfixe et l'app entière s'ouvrait
 * dans Safari au lieu de rester dans la coquille — dès le premier redirect
 * après le splash. `server.url` doit rester la racine du domaine (le préfixe
 * matche alors n'importe quel chemin) ; `server.appStartPath`, un champ
 * Capacitor séparé, porte le chemin de la toute première page chargée
 * (CAPInstanceConfiguration.swift → appStartServerURL) sans jamais entrer
 * dans cette comparaison.
 *
 * Piège suivant, également réel : `appStartPath` doit EN PLUS exister comme
 * fichier local dans `webDir`, même si le contenu réel vient du réseau —
 * Capacitor vérifie `webDir + appStartPath` avant de charger quoi que ce
 * soit (CAPBridgeViewController.swift → loadWebView()) :
 *   guard FileManager.default.fileExists(atPath: appStartFileURL.path)
 *   else { fatalLoadError() }   // exit(1) immédiat, avant toute requête réseau
 * D'où `capacitor/www/dashboard`, un fichier vide qui n'est jamais servi —
 * seule son existence compte. Changer `appStartPath` exige un fichier du
 * même nom au même endroit, sous peine du même crash.
 */
const rawServerUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://qonforme.fr/dashboard'
const parsedServerUrl = new URL(rawServerUrl)
const serverUrl = parsedServerUrl.origin
const isLocalServer = parsedServerUrl.protocol === 'http:'
/*
 * `URL.appendingPathComponent` (utilisé par Capacitor pour construire
 * appStartServerURL) encoderait un `?` littéral au lieu de l'interpréter
 * comme début de requête — une query string ici casserait le chemin. On se
 * limite donc au chemin ; distinguer le trafic natif dans PostHog se fait
 * mieux côté JS, avec Capacitor.getPlatform(), qui couvre aussi les pages
 * suivantes et pas seulement ce tout premier chargement.
 */
const appStartPath =
  parsedServerUrl.pathname !== '/' ? parsedServerUrl.pathname : undefined

const config: CapacitorConfig = {
  appId: 'fr.qonforme.app',
  appName: 'Qonforme',

  /*
   * Capacitor exige un `webDir` même en mode serveur distant : son contenu est
   * copié dans le projet Xcode par `cap sync`. Avec `server.url` renseigné, la
   * webview charge toujours le site en ligne — ces fichiers locaux ne servent
   * qu'au repli `errorPath` ci-dessous.
   */
  webDir: 'capacitor/www',

  server: {
    // Racine du domaine uniquement — jamais de chemin ici, voir l'explication ci-dessus.
    url: serverUrl,
    // Chemin de la première page chargée ; sans effet sur les navigations suivantes.
    appStartPath,
    /*
     * Sans effet en mode server.url distant (vérifié dans le code source iOS de
     * Capacitor : consommé uniquement par le mode fichiers locaux, absent de
     * la moindre autre logique). Conservé tel quel — un identifiant stable,
     * pas une valeur qui doit suivre server.url quand celui-ci change pour
     * un aperçu Vercel ou un serveur local.
     */
    hostname: 'qonforme.fr',
    androidScheme: 'https',
    iosScheme: 'https',
    // HTTP en clair uniquement pour un serveur de dev local.
    cleartext: isLocalServer,
    /*
     * Serveur injoignable au lancement : sans cette page, WKWebView afficherait
     * l'erreur brute de WebKit à la place de l'app.
     */
    errorPath: 'error.html',
  },

  ios: {
    /*
     * `always` fait respecter les zones sûres (encoche, Dynamic Island, barre
     * d'accueil) par la webview elle-même : le CSS `env(safe-area-inset-*)` déjà
     * en place dans les layouts continue de fonctionner à l'identique.
     */
    contentInset: 'always',
    // Le scroll est géré par les conteneurs de l'app (`overflow-y: auto`),
    // pas par la webview — évite le double défilement.
    scrollEnabled: true,
    backgroundColor: '#F8FAFC',
    /*
     * Laisser à `false` : `true` restreindrait la navigation aux domaines
     * déclarés dans WKAppBoundDomains et casserait les redirections
     * Stripe Checkout et Supabase Auth.
     */
    limitsNavigationsToAppBoundDomains: false,
  },

  plugins: {
    SplashScreen: {
      // Masqué par <NativeAppInit /> une fois l'interface prête : sinon l'écran
      // de démarrage disparaîtrait avant le premier rendu, laissant un flash blanc.
      launchAutoHide: false,
      backgroundColor: '#F8FAFC',
      showSpinner: false,
      // Fondu court à la disparition, pour enchaîner sans à-coup sur l'interface.
      launchFadeOutDuration: 200,
    },

    StatusBar: {
      // Texte sombre sur fond clair — le thème mobile est forcé en clair.
      style: 'LIGHT',
      backgroundColor: '#F8FAFC',
      overlaysWebView: false,
    },

    Keyboard: {
      // `body` redimensionne le document : les champs restent visibles au-dessus
      // du clavier dans les formulaires de facture, sans casser `100dvh`.
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },

    PushNotifications: {
      // Bannière + son quand une relance arrive alors que l'app est ouverte.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
