/**
 * Adaptateur par défaut : aucune plateforme agréée raccordée.
 *
 * Rien n'est reçu, rien n'est transmis, l'annuaire n'est pas consulté.
 * L'émission lève PaNotConnectedError : aucun appelant ne doit laisser croire
 * qu'une facture est partie par une plateforme.
 */
import { PaNotConnectedError, type PlatformAdapter } from "@/lib/pa/types"

export function createNoneAdapter(): PlatformAdapter {
  return {
    id: "none",
    label: null,
    connected: false,
    async listInboundInvoices() {
      return { invoices: [], nextCursor: null }
    },
    async sendStatus() {
      return { transmitted: false }
    },
    async searchDirectory() {
      return []
    },
    async issueInvoice() {
      throw new PaNotConnectedError()
    },
    async verifyWebhook() {
      return null
    },
  }
}
