/**
 * Client sans adresse email à l'envoi d'un document : la route répond 422 avec ce
 * code ; l'éditeur ouvre alors la fiche du document avec la fenêtre d'envoi, qui
 * demande l'adresse au lieu de bloquer. Module pur (navigateur et serveur).
 */
export const CLIENT_EMAIL_REQUIRED = "CLIENT_EMAIL_REQUIRED"

export function needsClientEmail(status: number, json: unknown): boolean {
  return status === 422 && (json as { code?: unknown } | null)?.code === CLIENT_EMAIL_REQUIRED
}

/** Fiche du document avec la fenêtre d'envoi ouverte (`?send=1`). */
export const sendWindowHref = (path: string) => `${path}?send=1`
