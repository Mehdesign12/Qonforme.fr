'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, Panel, StatusPill } from '@/components/app/kit'
import { fmtDate, planLabel } from '@/components/admin/ui'
import type { TestAccount } from '@/lib/stripe/test-accounts'

export function TestAccountsPanel({ accounts }: { accounts: TestAccount[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [confirmPurge, setConfirmPurge] = useState(false)

  const call = (url: string, init: RequestInit, success: (data: Record<string, unknown>) => string) => {
    startTransition(async () => {
      try {
        const res = await fetch(url, init)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(typeof data.error === 'string' ? data.error : "L'action n'a pas pu aboutir.")
          return
        }
        toast.success(success(data))
        router.refresh()
      } catch {
        toast.error('Erreur réseau. Réessayez.')
      }
    })
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    call(
      '/api/admin/stripe-test-accounts',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) },
      () => { setEmail(''); return 'Compte ajouté : il paiera dans le bac à sable.' },
    )
  }

  const remove = (account: TestAccount) =>
    call(
      `/api/admin/stripe-test-accounts?userId=${encodeURIComponent(account.userId)}`,
      { method: 'DELETE' },
      (data) => (data.deletedSubscription ? 'Compte retiré, abonnement d’essai effacé.' : 'Compte retiré.'),
    )

  const purge = () => {
    setConfirmPurge(false)
    call('/api/admin/stripe-test-accounts/purge', { method: 'POST' }, (data) => `${data.deleted ?? 0} abonnement(s) d’essai effacé(s).`)
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Comptes d’essai" bodyClassName="flex flex-col gap-4 px-5 pb-5">
        <p className="text-sm text-[var(--q-text-3)]">
          Un compte d’essai voit le vrai site, mais ses paiements passent par le bac à sable Stripe : aucune carte réelle,
          aucun débit. Tous les autres comptes paient en production, toujours.
        </p>

        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="test-email">Adresse email du compte</label>
          <input
            id="test-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="adresse du compte Qonforme"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="q-input h-10 flex-1 text-base md:text-sm"
          />
          <button type="submit" disabled={pending || !email.trim()} className="q-btn q-btn-primary">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            Ajouter
          </button>
        </form>

        {accounts.length === 0 ? (
          <EmptyState title="Aucun compte d’essai" text="Ajoutez votre propre compte pour tester un paiement sans risque." />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--q-line)]">
            {accounts.map((account) => (
              <li key={account.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-medium text-[var(--q-ink)]">{account.email}</span>
                  <span className="text-sm text-[var(--q-text-4)]">
                    Ajouté le {fmtDate(account.addedAt)}
                    {account.subscription
                      ? ` · ${planLabel(account.subscription.plan)} (${account.subscription.status})`
                      : ' · aucun abonnement'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone="warn">ESSAI</StatusPill>
                  <button
                    type="button"
                    onClick={() => remove(account)}
                    disabled={pending}
                    className="q-btn q-btn-secondary q-btn-sm"
                    aria-label={`Retirer ${account.email}`}
                  >
                    <Trash2 aria-hidden />
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Nettoyer avant l’ouverture" bodyClassName="flex flex-col gap-3 px-5 pb-5">
        <p className="text-sm text-[var(--q-text-3)]">
          Efface tous les abonnements du bac à sable de la base du site. Les abonnements de production ne sont jamais touchés.
          À faire avant d’ouvrir la vente, pour qu’aucun compte ne garde un accès « payé » fictif.
        </p>
        {confirmPurge ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={purge} disabled={pending} className="q-btn q-btn-danger q-btn-sm">
              Oui, effacer les abonnements d’essai
            </button>
            <button type="button" onClick={() => setConfirmPurge(false)} className="q-btn q-btn-secondary q-btn-sm">
              Annuler
            </button>
          </div>
        ) : (
          <div>
            <button type="button" onClick={() => setConfirmPurge(true)} disabled={pending} className="q-btn q-btn-secondary q-btn-sm">
              <Trash2 aria-hidden />
              Supprimer les abonnements d’essai
            </button>
          </div>
        )}
      </Panel>
    </div>
  )
}
