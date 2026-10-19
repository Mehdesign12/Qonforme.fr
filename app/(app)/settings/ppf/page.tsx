import type { Metadata } from "next"
import { EInvoicingView } from "@/components/settings/EInvoicingView"

export const metadata: Metadata = { title: "Facturation électronique — Qonforme" }
export const dynamic = "force-dynamic"

export default function PPFGuidePage() {
  return <EInvoicingView mode="app" />
}
