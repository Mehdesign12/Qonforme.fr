import type { Metadata } from "next"
import { ClientDetail } from "@/components/clients/ClientDetail"

export const metadata: Metadata = { title: "Détail client" }
export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  return (
    <div className="max-w-4xl animate-fade-in">
      <ClientDetail clientId={id} />
    </div>
  )
}
