'use client'

export const dynamic = "force-dynamic"

import { toast } from "sonner"
import { ImportView } from "@/components/reception/ImportView"
import { DEMO_COMPANY } from "@/lib/demo/data"
import { DEMO_RECEIVED, demoDuplicateXml, demoSampleXml } from "@/lib/demo/reception"
import type { AnalyzeResponse } from "@/lib/reception/view"

/**
 * Miroir de /received-invoices/import : le fichier est lu dans le navigateur,
 * par les mêmes lecteurs et contrôles que l'application (lib/reception),
 * chargés seulement quand un fichier est déposé. Rien n'est enregistré.
 */
async function analyze(file: File): Promise<AnalyzeResponse & { available?: boolean }> {
  const [{ prepareUpload }, { sameSupplier }] = await Promise.all([
    import("@/lib/reception/prepare"),
    import("@/lib/reception/record"),
  ])
  const prepared = await prepareUpload(new Uint8Array(await file.arrayBuffer()), {
    companySiren: DEMO_COMPANY.siren,
    findDuplicate: async (record) => {
      const year = record.issue_date.slice(0, 4)
      const hit = DEMO_RECEIVED.find((d) =>
        d.invoice_number.replace(/\s+/g, "").toUpperCase() === record.number_key
        && d.issue_date.slice(0, 4) === year
        && sameSupplier({ siren: d.supplier_siren, name: d.supplier_name }, { siren: record.supplier_siren, name: record.supplier_name }),
      )
      return hit ? { id: hit.id, created_at: hit.created_at } : null
    },
  })
  if (!prepared.ok) return { ok: false, error: prepared.error, code: prepared.code }
  if (prepared.kind === "structured") {
    return { ok: true, kind: "structured", format: prepared.format, invoice: prepared.invoice, checks: prepared.checks, blocking: prepared.blocking }
  }
  if (prepared.kind === "pdf_only") return { ok: true, kind: "pdf_only", format: "pdf", note: prepared.note }
  return { ok: false, error: "Analyse inattendue." }
}

const xmlFile = (name: string, xml: string) => new File([xml], name, { type: "application/xml" })

export default function DemoImportReceivedInvoicePage() {
  return (
    <ImportView
      backHref="/demo/received-invoices"
      analyze={analyze}
      save={async () => {
        toast("Créez un compte pour enregistrer vos factures reçues", {
          action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
        })
        return { ok: false, error: "Démo : rien n'est enregistré. Créez un compte pour importer vos factures." }
      }}
      onSaved={() => undefined}
      duplicateHref={(id) => `/demo/received-invoices/${id}`}
      samples={[
        { label: "Essayer une facture d’exemple", file: () => xmlFile("CIL-26-04655.xml", demoSampleXml()) },
        { label: "Essayer un doublon", file: () => xmlFile("LLM-2026-0917.xml", demoDuplicateXml()) },
      ]}
      saveHint="Démo : la lecture et les contrôles sont réels, l’enregistrement demande un compte."
    />
  )
}
