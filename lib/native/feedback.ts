import { isNativeApp } from './platform'

/**
 * Retour haptique.
 *
 * Sans effet sur le web : `navigator.vibrate` n'existe pas sur iOS Safari et
 * produirait un buzz grossier sur Android, très loin du Taptic Engine.
 * Un appel depuis un navigateur est donc simplement ignoré.
 */

type ImpactWeight = 'light' | 'medium' | 'heavy'
type NotificationOutcome = 'success' | 'warning' | 'error'

/** Confirme un appui : sélection d'un client, ajout d'une ligne de facture. */
export async function hapticImpact(weight: ImpactWeight = 'light'): Promise<void> {
  if (!isNativeApp()) return

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const style = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }[weight]

    await Haptics.impact({ style })
  } catch {
    // Plugin absent ou appareil sans moteur haptique : purement décoratif.
  }
}

/** Ponctue l'issue d'une action : facture envoyée, paiement refusé. */
export async function hapticNotify(outcome: NotificationOutcome): Promise<void> {
  if (!isNativeApp()) return

  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    const type = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    }[outcome]

    await Haptics.notification({ type })
  } catch {
    // Idem : jamais bloquant.
  }
}
