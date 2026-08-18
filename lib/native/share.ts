import { isNativeApp } from './platform'

export type SharePayload = {
  /** Titre de la feuille de partage — « Facture F-2026-0042 ». */
  title: string
  /** Message pré-rempli dans Mail, Messages ou WhatsApp. */
  text?: string
  /** Lien partagé (page de la facture, PDF public). */
  url?: string
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported'

/**
 * Ouvre la feuille de partage du système.
 *
 * Trois niveaux, du plus riche au plus universel :
 *   1. app native  → feuille de partage iOS complète (AirDrop, Mail, Messages…) ;
 *   2. navigateur avec Web Share API → feuille du système (Safari iOS, Chrome Android) ;
 *   3. desktop     → copie du lien dans le presse-papiers.
 *
 * Retourne l'issue pour que l'appelant affiche le bon message : un `cancelled`
 * ne doit pas déclencher de toast « Lien copié ».
 */
export async function shareContent(payload: SharePayload): Promise<ShareResult> {
  const { title, text, url } = payload

  if (isNativeApp()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text, url, dialogTitle: title })
      return 'shared'
    } catch {
      // L'utilisateur a fermé la feuille, ou le plugin est indisponible.
      return 'cancelled'
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (error) {
      // `AbortError` = fermeture volontaire ; toute autre erreur bascule sur la copie.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }

  if (url && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url)
      return 'copied'
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission).
    }
  }

  return 'unsupported'
}
