import { isNativeApp } from './platform'

/**
 * Capture ou sélectionne une photo via l'appareil natif (caméra ou
 * photothèque — l'utilisateur choisit via le sélecteur système iOS).
 *
 * Retourne un `File` standard : réutilisable tel quel avec n'importe quel
 * endpoint d'upload existant (ex: `/api/company/logo`, qui attend déjà un
 * `FormData` avec un champ `file`) — aucune API serveur dédiée nécessaire.
 *
 * Toujours `null` sur le web (n'est appelée que derrière un bouton visible
 * uniquement dans l'app, voir `isNativeApp()` côté composant) et quand
 * l'utilisateur annule le sélecteur — ce n'est pas une vraie erreur.
 */
export async function capturePhoto(filename = 'photo.jpg'): Promise<File | null> {
  if (!isNativeApp()) return null

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')

    const photo = await Camera.getPhoto({
      quality: 85,
      // Une image de logo n'a jamais besoin de la pleine résolution d'un
      // capteur photo — on limite la largeur pour rester confortablement
      // sous la limite de 2 Mo côté serveur sans complexifier l'upload.
      width: 1600,
      resultType: CameraResultType.Base64,
      // Affiche le choix natif "Prendre une photo" / "Choisir dans la
      // photothèque" plutôt que d'imposer l'un ou l'autre.
      source: CameraSource.Prompt,
      promptLabelHeader: 'Photo du logo',
      promptLabelPhoto: 'Choisir dans la photothèque',
      promptLabelPicture: 'Prendre une photo',
    })

    if (!photo.base64String) return null

    // On ne fait confiance qu'à jpeg/png (seuls formats que l'API camera
    // produit réellement) — le serveur rejette tout le reste.
    const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg'

    const byteChars = atob(photo.base64String)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)

    return new File([bytes], filename, { type: mimeType })
  } catch (error) {
    // L'utilisateur a fermé le sélecteur sans choisir — Capacitor le signale
    // comme une erreur, ce n'en est pas une du point de vue produit.
    if (error instanceof Error && /cancel/i.test(error.message)) return null
    console.error('[camera] Capture impossible', error)
    return null
  }
}
