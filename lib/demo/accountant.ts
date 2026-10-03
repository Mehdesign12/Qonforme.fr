/**
 * Démo de l'accès comptable : Paramètres › Accès comptable de l'artisan de
 * démo, et l'espace de son comptable (/demo/comptable), calculé sur les
 * factures et avoirs de lib/demo/data.ts avec les mêmes règles que le réel
 * (lib/accountant/dossier.ts) : les brouillons n'y apparaissent pas.
 *
 * Données fictives : cabinet et adresses en @example.com (domaine réservé).
 */
import { DEMO_COMPANY, DEMO_CREDIT_NOTES, DEMO_INVOICES, DEMO_TODAY } from "@/lib/demo/data"
import { buildDossier } from "@/lib/accountant/dossier"
import type { AccessOverview, DossierData, DossierSummary, Period } from "@/lib/accountant/types"

/** Identifiant de l'accès de démo (adresse /demo/comptable/[id]). */
export const DEMO_ACCESS_ID = "garnier"

export const DEMO_ACCOUNTANT = {
  name: "Claire Lemoine",
  email: "c.lemoine@cabinet-lemoine.example.com",
  firm: "Cabinet Lemoine",
}

/** Paramètres › Accès comptable de l'artisan de démo. */
export const DEMO_ACCESS_OVERVIEW: AccessOverview = {
  available: true,
  accesses: [
    {
      id: "acces-lemoine",
      email: DEMO_ACCOUNTANT.email,
      label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`,
      status: "active",
      invitedAt: "2026-09-02T08:12:00.000Z",
      expiresAt: "2026-09-09T08:12:00.000Z",
      acceptedAt: "2026-09-02T09:41:00.000Z",
      lastSeenAt: "2026-09-30T15:06:00.000Z",
    },
    {
      id: "acces-assistante",
      email: "accueil@cabinet-lemoine.example.com",
      label: "Accueil du cabinet",
      status: "pending",
      invitedAt: "2026-09-29T07:30:00.000Z",
      expiresAt: "2026-10-06T07:30:00.000Z",
      acceptedAt: null,
      lastSeenAt: null,
    },
  ],
  events: [
    { id: "e8", accessId: "acces-lemoine", email: DEMO_ACCOUNTANT.email, label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`, action: "export_pdf_zip", periodFrom: "2026-09-01", periodTo: "2026-09-30", detail: "7 PDF", at: "2026-09-30T15:06:00.000Z" },
    { id: "e7", accessId: "acces-lemoine", email: DEMO_ACCOUNTANT.email, label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`, action: "export_csv", periodFrom: "2026-09-01", periodTo: "2026-09-30", detail: "7 documents", at: "2026-09-30T15:04:00.000Z" },
    { id: "e6", accessId: "acces-lemoine", email: DEMO_ACCOUNTANT.email, label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`, action: "viewed", periodFrom: null, periodTo: null, detail: null, at: "2026-09-30T15:01:00.000Z" },
    { id: "e5", accessId: "acces-assistante", email: "accueil@cabinet-lemoine.example.com", label: "Accueil du cabinet", action: "invited", periodFrom: null, periodTo: null, detail: null, at: "2026-09-29T07:30:00.000Z" },
    { id: "e4", accessId: "acces-lemoine", email: DEMO_ACCOUNTANT.email, label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`, action: "export_fec", periodFrom: "2026-01-01", periodTo: "2026-08-31", detail: "9 documents", at: "2026-09-08T09:12:00.000Z" },
    { id: "e3", accessId: "acces-lemoine", email: DEMO_ACCOUNTANT.email, label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`, action: "viewed", periodFrom: null, periodTo: null, detail: null, at: "2026-09-08T09:10:00.000Z" },
    { id: "e2", accessId: "acces-lemoine", email: DEMO_ACCOUNTANT.email, label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`, action: "accepted", periodFrom: null, periodTo: null, detail: null, at: "2026-09-02T09:41:00.000Z" },
    { id: "e1", accessId: "acces-lemoine", email: DEMO_ACCOUNTANT.email, label: `${DEMO_ACCOUNTANT.name}, ${DEMO_ACCOUNTANT.firm}`, action: "invited", periodFrom: null, periodTo: null, detail: null, at: "2026-09-02T08:12:00.000Z" },
  ],
}

/** Dossiers du comptable de démo : l'entreprise de démo. */
export const DEMO_DOSSIERS: DossierSummary[] = [
  {
    accessId: DEMO_ACCESS_ID,
    companyName: DEMO_COMPANY.name,
    siren: DEMO_COMPANY.siren,
    city: DEMO_COMPANY.city,
    acceptedAt: "2026-09-02T09:41:00.000Z",
    lastSeenAt: "2026-09-30T15:06:00.000Z",
  },
]

/** Contenu du dossier de démo pour une période. */
export function demoDossier(period: Period): DossierData {
  return buildDossier({
    company: { name: DEMO_COMPANY.name, siren: DEMO_COMPANY.siren, city: DEMO_COMPANY.city },
    period,
    today: DEMO_TODAY,
    supplierInvoices: null,
    invoices: DEMO_INVOICES.map((i) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      status: i.status,
      issue_date: i.issue_date,
      due_date: i.due_date,
      subtotal_ht: i.subtotal_ht,
      total_vat: i.total_vat,
      total_ttc: i.total_ttc,
      lines: i.lines,
      client_name: i.client.name,
    })),
    creditNotes: DEMO_CREDIT_NOTES.map((c) => ({
      id: c.id,
      credit_note_number: c.credit_note_number,
      issue_date: c.issue_date,
      subtotal_ht: c.subtotal_ht,
      total_vat: c.total_vat,
      total_ttc: c.total_ttc,
      lines: c.lines,
      reason: c.reason,
      client_name: c.client.name,
      original_invoice_number: c.original_invoice_number,
    })),
  })
}
