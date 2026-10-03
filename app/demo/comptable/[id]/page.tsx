import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AccountantShell } from "@/components/accountant/AccountantShell"
import { DossierView } from "@/components/accountant/DossierView"
import { DEMO_TODAY } from "@/lib/demo/data"
import { DEMO_ACCESS_ID, DEMO_ACCOUNTANT, demoDossier } from "@/lib/demo/accountant"
import { defaultPeriod, parsePeriod, periodPresets } from "@/lib/accountant/rules"

export const metadata: Metadata = {
  title: "Dossier — Démo de l'espace comptable",
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ du?: string; au?: string }>
}

/** Démo d'un dossier de l'espace comptable : factures et avoirs de démo, mêmes règles que le réel. */
export default async function DemoDossierPage({ params, searchParams }: Props) {
  const { id } = await params
  if (id !== DEMO_ACCESS_ID) notFound()
  const sp = await searchParams
  const period = parsePeriod(sp.du, sp.au) ?? defaultPeriod(DEMO_TODAY)
  return (
    <AccountantShell mode="demo" email={DEMO_ACCOUNTANT.email}>
      <DossierView
        mode="demo"
        data={demoDossier(period)}
        presets={periodPresets(DEMO_TODAY)}
        basePath={`/demo/comptable/${DEMO_ACCESS_ID}`}
        backHref="/demo/comptable"
        exportUrl={null}
      />
    </AccountantShell>
  )
}
