import { Capacitor } from '@capacitor/core'

/**
 * Détection de la coquille native.
 *
 * Le même code React sert le site web et l'app iOS : ces helpers activent une
 * capacité native quand elle existe, sans jamais casser le web.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Ne pas remplacer cet import par une lecture de `window.Capacitor`
 * ─────────────────────────────────────────────────────────────────────────────
 * C'est tentant pour alléger le bundle, mais faux : le `native-bridge.js`
 * injecté par iOS pose bien `window.Capacitor`, avec les primitives du pont
 * (`postMessage`, `getServerUrl`…) — pas `isNativePlatform` ni `getPlatform`,
 * qui sont ajoutés par `createCapacitor()` dans `@capacitor/core`. Sans cet
 * import, `isNativeApp()` renverrait `false` dans l'app compilée et toute
 * l'initialisation native serait silencieusement inerte.
 *
 * Le coût est nul en pratique : webpack place ce module dans un chunk
 * asynchrone (vérifié — le First Load JS de chaque page est inchangé), et les
 * plugins sont importés dynamiquement, donc seul l'appareil natif les télécharge.
 */

export type NativePlatform = 'ios' | 'android' | 'web'

/** `true` uniquement dans l'app compilée (iOS/Android), jamais dans un navigateur. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** `true` dans l'app iOS compilée — à ne pas confondre avec « Safari sur iPhone ». */
export function isNativeIOS(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

export function getPlatform(): NativePlatform {
  return Capacitor.getPlatform() as NativePlatform
}

/**
 * Un plugin donné est-il réellement disponible ?
 *
 * Utile quand un plugin natif n'a pas d'implémentation web : l'appeler dans un
 * navigateur lèverait une `Unimplemented`.
 */
export function isPluginAvailable(name: string): boolean {
  return Capacitor.isPluginAvailable(name)
}
