'use client'

import { ChantiersListView } from "@/components/chantiers/ChantiersListView"
import { DEMO_CHANTIERS } from "@/lib/demo/chantiers"

export default function DemoChantiersPage() {
  return <ChantiersListView chantiers={DEMO_CHANTIERS} detailHref={(id) => `/demo/chantiers/${id}`} newHref="/demo/chantiers/new" />
}
