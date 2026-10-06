import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { hasDossiers } from '@/lib/accountant/server'
import { isMissingSchemaError } from '@/lib/supabase/schema-guard'
import { parseLegalProfile, type TradeId, type VatRegime } from '@/lib/legal/profile'
import { loadPendingReminder } from '@/lib/onboarding/store'
import DashboardClient, { type InscriptionLaunch } from '@/components/dashboard/DashboardClient'
import { DashboardBody } from '@/components/dashboard/DashboardBody'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { getDashboardView } from '@/components/dashboard/data'
import {
  inscriptionTile, inscriptionWindowOpen, parsePeriod, todayInParis,
  type DashPeriod, type DashboardInput, type InscriptionFacts,
} from '@/components/dashboard/model'

export const metadata: Metadata = { title: 'Tableau de bord' }
export const dynamic = 'force-dynamic'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface CompanyRow {
  name: string | null
  siren: string | null
  address: string | null
  zip_code: string | null
  city: string | null
  onboarding_seen_at: string | null
  legal_profile?: unknown
}

const COMPANY_FIELDS = 'name, siren, address, zip_code, city, onboarding_seen_at'

/**
 * Entreprise du compte, avec son profil légal quand la colonne existe
 * (migration 20261003_legal_profile_btp.sql) : sans elle, la fenêtre
 * « Bienvenue » n'a pas d'étape métier.
 */
async function readCompany(supabase: Supabase, userId: string) {
  const withProfile = await supabase
    .from('companies')
    .select(`${COMPANY_FIELDS}, legal_profile`)
    .eq('user_id', userId)
    .maybeSingle()
  if (!withProfile.error) {
    return { row: (withProfile.data as CompanyRow | null) ?? null, profileAvailable: true, failed: false }
  }
  if (!isMissingSchemaError(withProfile.error)) return { row: null, profileAvailable: false, failed: true }
  const plain = await supabase.from('companies').select(COMPANY_FIELDS).eq('user_id', userId).maybeSingle()
  return { row: (plain.data as CompanyRow | null) ?? null, profileAvailable: false, failed: !!plain.error }
}

/** Ce que la fenêtre « Bienvenue » reçoit en plus des faits qui décident de son ouverture. */
interface InscriptionContext {
  facts: InscriptionFacts
  justCreated: boolean
  email: string
  firstName: string
  company: InscriptionLaunch['company']
  trade: TradeId | null
  vatRegime: VatRegime | null
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { periode?: string; bienvenue?: string; inscription?: string }
}) {
  const period = parsePeriod(searchParams?.periode)
  let userId: string | null = null
  let firstName = ''
  let company: DashboardInput['company'] = null
  let showWelcome = false
  let companyMissing = false
  let inscription: InscriptionContext | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      userId = user.id
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      // Prénom depuis user_metadata (titre d'accueil d'un compte neuf)
      firstName = str(meta.first_name)

      const read = await readCompany(supabase, user.id)
      // Aucune ligne → entreprise jamais créée ; une erreur (réseau) n'ouvre rien et ne redirige pas
      if (!read.failed) {
        const row = read.row
        companyMissing = !row
        if (row) {
          company = { name: row.name, siren: row.siren, address: row.address, zip_code: row.zip_code, city: row.city }
          // Premiers pas pas encore vus (fenêtre de bienvenue d'un compte qui a déjà des documents)
          // Ancienne fenêtre de premiers pas : jamais pour un compte de l'inscription en deux champs
          showWelcome = !row.onboarding_seen_at && meta.signup_wizard !== true
        }
        const profile = row && read.profileAvailable ? parseLegalProfile(row.legal_profile) : null
        inscription = {
          facts: {
            company: !!row,
            trade: !!(profile?.trade && profile?.vat_regime),
            firstName: !!firstName,
            profileAvailable: read.profileAvailable,
            wizard: meta.signup_wizard === true,
            windowClosed: meta.signup_window_closed === true,
            resume: searchParams?.inscription === 'reprendre',
          },
          justCreated: searchParams?.bienvenue === '1',
          email: user.email ?? '',
          firstName,
          company: row
            ? {
              name: str(row.name),
              siren: str(row.siren) || null,
              address: str(row.address),
              zip_code: str(row.zip_code),
              city: str(row.city),
            }
            : null,
          trade: profile?.trade ?? null,
          vatRegime: profile?.vat_regime ?? null,
        }
      }
    }
  } catch {
    // Non bloquant
  }

  // Hors du try/catch : redirect() lève une exception que le catch avalait.
  // Un comptable invité n'a pas d'entreprise : il va à son espace (lib/accountant).
  // Tout autre compte sans entreprise reste ici : la fenêtre « Bienvenue » la demande.
  if (companyMissing && userId && (await hasDossiers(userId))) redirect('/comptable')

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent
        userId={userId}
        firstName={firstName}
        company={company}
        showWelcome={showWelcome}
        period={period}
        inscription={inscription}
      />
    </Suspense>
  )
}

/** Données (requêtes en parallèle) puis rendu, diffusé après le squelette. */
async function DashboardContent({
  userId,
  firstName,
  company,
  showWelcome,
  period,
  inscription,
}: {
  userId: string | null
  firstName: string
  company: DashboardInput['company']
  showWelcome: boolean
  period: DashPeriod
  inscription: InscriptionContext | null
}) {
  const supabase = await createClient()
  const tile = inscription ? inscriptionTile(inscription.facts) : null
  const view = await getDashboardView({
    supabase, userId, firstName, company, today: todayInParis(), period, inscription: tile,
  })

  // Fenêtre « Bienvenue » : jamais pour un compte qui a déjà des documents et son entreprise
  let launch: InscriptionLaunch | null = null
  if (inscription && tile && userId) {
    const open = inscriptionWindowOpen(inscription.facts, view.isNewAccount)
    let startAvailable = false
    if (open) {
      // Devis d'essai et rappel : seulement une fois la migration des emails de démarrage appliquée
      const pending = await loadPendingReminder(supabase, userId).catch(() => null)
      startAvailable = !!pending?.available && !pending.error
    }
    launch = {
      mode: 'app',
      open,
      resume: inscription.facts.resume,
      justCreated: inscription.justCreated,
      initialStep: tile.step,
      profileAvailable: inscription.facts.profileAvailable,
      startAvailable,
      email: inscription.email,
      firstName: inscription.firstName,
      company: inscription.company,
      trade: inscription.trade,
      vatRegime: inscription.vatRegime,
    }
  }

  return (
    <DashboardClient showWelcome={showWelcome} inline={view.isNewAccount} inscription={launch}>
      <DashboardBody view={view} />
    </DashboardClient>
  )
}
