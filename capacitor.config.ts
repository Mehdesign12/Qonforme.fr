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
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://qonforme.fr'
const isLocalServer = serverUrl.startsWith('http://')

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
    url: serverUrl,
    // Les cookies de session Supabase doivent être partagés avec le domaine chargé.
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
