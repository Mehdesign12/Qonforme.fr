import type { Metadata } from "next"
import NewQuoteForm from "@/components/quotes/NewQuoteForm"

export const metadata: Metadata = { title: "Nouveau devis" }
export const dynamic = "force-dynamic"

export default function NewQuotePage() {
  return <NewQuoteForm />
}
