"use client"

/**
 * Admin › Utilisateurs : créer un compte (testeur) et offrir une formule à un
 * compte sans abonnement Stripe en cours (lib/admin/grant.ts).
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Copy, Gift, KeyRound, Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { GRANT_DURATIONS, PASSWORD_MIN, type GrantDuration } from "@/lib/admin/grant"

type PlanChoice = "none" | "starter" | "pro"

interface PlanState {
  plan: PlanChoice
  period: "monthly" | "yearly"
  months: GrantDuration
  note: string
}

const PLAN_CHOICES: { value: PlanChoice; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "starter", label: "Essentiel" },
  { value: "pro", label: "Artisan" },
]

function PlanFields({ state, onChange, allowNone }: { state: PlanState; onChange: (s: PlanState) => void; allowNone: boolean }) {
  const set = (patch: Partial<PlanState>) => onChange({ ...state, ...patch })
  const choices = allowNone ? PLAN_CHOICES : PLAN_CHOICES.filter((c) => c.value !== "none")
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="q-label">Formule offerte</span>
        <div className="q-seg self-start" role="group" aria-label="Formule offerte">
          {choices.map((c) => (
            <button key={c.value} type="button" aria-pressed={state.plan === c.value} onClick={() => set({ plan: c.value })}>{c.label}</button>
          ))}
        </div>
        <span className="q-field-hint">Sans paiement : mêmes droits qu&apos;une formule payée, aucune facture Stripe.</span>
      </div>
      {state.plan !== "none" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Durée</span>
            <select
              className="q-input"
              value={state.months === null ? "" : String(state.months)}
              onChange={(e) => set({ months: (e.target.value === "" ? null : Number(e.target.value)) as GrantDuration })}
            >
              {GRANT_DURATIONS.map((d) => <option key={d.label} value={d.value === null ? "" : String(d.value)}>{d.label}</option>)}
            </select>
            <span className="q-field-hint">À l&apos;échéance, le compte repasse en version gratuite.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="q-label">Facturation affichée</span>
            <select className="q-input" value={state.period} onChange={(e) => set({ period: e.target.value === "yearly" ? "yearly" : "monthly" })}>
              <option value="monthly">Mensuelle</option>
              <option value="yearly">Annuelle</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="q-label">Note (facultatif)</span>
            <Input value={state.note} onChange={(e) => setNote(e.target.value)} placeholder="Testeur, partenaire…" maxLength={200} />
            <span className="q-field-hint">Visible dans l&apos;admin seulement.</span>
          </label>
        </div>
      )}
    </div>
  )
  function setNote(note: string) { set({ note }) }
}

function grantBody(s: PlanState) {
  return s.plan === "none" ? { plan: "none" } : { plan: s.plan, period: s.period, months: s.months, note: s.note }
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = new Uint32Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copié")
  } catch {
    toast.error("Copie impossible : sélectionnez le texte à la main.")
  }
}

/* ------------------------------------------------------------------ */
/* Créer un compte                                                     */
/* ------------------------------------------------------------------ */

export function CreateUserButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [testAccount, setTestAccount] = useState(false)
  const [plan, setPlan] = useState<PlanState>({ plan: "starter", period: "monthly", months: null, note: "Testeur" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ userId: string; email: string; password: string; warnings: string[] } | null>(null)

  const reset = () => {
    setEmail(""); setPassword(""); setFirstName(""); setTestAccount(false)
    setPlan({ plan: "starter", period: "monthly", months: null, note: "Testeur" })
    setError(null); setCreated(null); setBusy(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, testAccount, ...grantBody(plan) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? "Le compte n'a pas pu être créé."); return }
      setCreated({ userId: data.userId, email: data.email, password, warnings: data.warnings ?? [] })
      router.refresh()
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => { reset(); setOpen(true) }} className="q-btn q-btn-primary">
        <UserPlus aria-hidden />Ajouter un utilisateur
      </button>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) reset() } }}>
        <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto sm:max-w-lg">
          {created ? (
            <>
              <div className="flex flex-col gap-1 pr-8">
                <DialogTitle>Compte créé</DialogTitle>
                <DialogDescription>Transmettez ces identifiants au testeur. Aucun email ne lui a été envoyé.</DialogDescription>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--q-ok-line)] bg-[var(--q-ok-bg)] p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span><span className="text-[var(--q-text-3)]">Email</span> <span className="font-mono">{created.email}</span></span>
                  <button type="button" className="q-btn q-btn-ghost q-btn-sm q-btn-icon" aria-label="Copier l'email" onClick={() => copy(created.email)}><Copy aria-hidden /></button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span><span className="text-[var(--q-text-3)]">Mot de passe</span> <span className="font-mono">{created.password}</span></span>
                  <button type="button" className="q-btn q-btn-ghost q-btn-sm q-btn-icon" aria-label="Copier le mot de passe" onClick={() => copy(created.password)}><Copy aria-hidden /></button>
                </div>
                <button type="button" className="q-btn q-btn-secondary q-btn-sm self-start" onClick={() => copy(`Adresse : https://qonforme.fr/login\nEmail : ${created.email}\nMot de passe : ${created.password}`)}>
                  <Copy aria-hidden />Tout copier
                </button>
              </div>
              {created.warnings.map((w) => <p key={w} role="alert" className="q-banner q-banner-warn !text-[13px]">{w}</p>)}
              <p className="q-field-hint">Le mot de passe n&apos;est pas gardé : il ne s&apos;affichera plus après fermeture.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="q-btn q-btn-ghost" onClick={() => { setOpen(false); reset() }}>Fermer</button>
                <Link href={`/admin/users/${created.userId}`} className="q-btn q-btn-primary" onClick={() => setOpen(false)}>Voir la fiche</Link>
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 pr-8">
                <DialogTitle>Ajouter un utilisateur</DialogTitle>
                <DialogDescription>Pour un testeur : le compte est prêt à l&apos;emploi, email confirmé, sans email envoyé.</DialogDescription>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="q-label">Email</span>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="testeur@exemple.fr" autoComplete="off" />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="q-label">Mot de passe</span>
                  <span className="flex gap-2">
                    <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={PASSWORD_MIN} required className="font-mono" autoComplete="new-password" />
                    <button type="button" className="q-btn q-btn-secondary shrink-0" onClick={() => setPassword(randomPassword())}>
                      <KeyRound aria-hidden />Générer
                    </button>
                  </span>
                  <span className="q-field-hint">{PASSWORD_MIN} caractères au moins. Affiché en clair pour pouvoir le transmettre.</span>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="q-label">Prénom (facultatif)</span>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </label>
              </div>
              <PlanFields state={plan} onChange={setPlan} allowNone />
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--q-accent)]" checked={testAccount} onChange={(e) => setTestAccount(e.target.checked)} />
                <span>
                  <span className="font-semibold text-[var(--q-ink)]">Compte d&apos;essai</span>
                  <span className="block text-[13px] text-[var(--q-text-3)]">S&apos;il paie, ce sera dans le bac à sable Stripe (cartes de test), comme dans Admin › Paiements.</span>
                </span>
              </label>
              {error && <p role="alert" className="q-field-error !text-[13px]">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="q-btn q-btn-ghost" disabled={busy} onClick={() => { setOpen(false); reset() }}>Annuler</button>
                <button type="submit" className="q-btn q-btn-primary" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
                  {busy ? "Création…" : "Créer le compte"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Offrir une formule à un compte existant                             */
/* ------------------------------------------------------------------ */

export function GrantPlanButton({ userId, label = "Offrir une formule", current }: { userId: string; label?: string; current?: { plan: "starter" | "pro"; period: "monthly" | "yearly" } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<PlanState>({ plan: current?.plan ?? "pro", period: current?.period ?? "monthly", months: null, note: "Testeur" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(grantBody(plan)),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? "La formule n'a pas pu être offerte."); return }
      toast.success("Formule offerte")
      setOpen(false)
      router.refresh()
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div>
        <button type="button" onClick={() => { setError(null); setOpen(true) }} className="q-btn q-btn-primary q-btn-sm">
          <Gift aria-hidden />{label}
        </button>
      </div>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v) }}>
        <DialogContent className="gap-4 sm:max-w-md">
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>Le compte reçoit la formule tout de suite, sans paiement. Il peut toujours en prendre une payante plus tard.</DialogDescription>
          </div>
          <PlanFields state={plan} onChange={setPlan} allowNone={false} />
          {error && <p role="alert" className="q-field-error !text-[13px]">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="q-btn q-btn-ghost" disabled={busy} onClick={() => setOpen(false)}>Annuler</button>
            <button type="button" className="q-btn q-btn-primary" disabled={busy} onClick={submit}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              {busy ? "En cours…" : "Offrir"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
