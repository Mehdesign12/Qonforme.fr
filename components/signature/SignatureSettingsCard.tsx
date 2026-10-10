"use client"

/**
 * Paramètres › Modèles de documents › « Signature en ligne » (DECISIONS § 11,
 * « Réglages ») : activation, code de vérification par email (par défaut
 * au-delà de 5 000 € TTC), validité d'un lien de bon de commande, relance
 * avant expiration et acompte demandé à la signature (ces deux derniers
 * masqués tant que 20261010_signature_withdrawal_deposit_reminder.sql n'est
 * pas appliquée).
 *
 * Compte gratuit : badge « Avec Essentiel » (DECISIONS § 12, point 4) ; les
 * réglages restent modifiables pour être prêts. Section masquée tant que la
 * migration 20261003_document_signatures.sql n'est pas appliquée.
 * Même composant pour la démo (`mode="demo"`), rien n'y est enregistré.
 */
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Switch } from "@/components/app/kit"
import { SettingRow, SettingsCard } from "@/components/settings/ui"
import type { ShellMode } from "@/components/layout/nav"
import { DEPOSIT_PERCENT_CHOICES, EXPIRY_REMINDER_DAY_CHOICES } from "@/lib/signature/rules"
import { DEFAULT_SIGNATURE_SETTINGS, type CodeMode, type SignatureSettings } from "@/lib/signature/types"
import { DEMO_DEPOSIT_PERCENT } from "@/lib/demo/signature"

const CODE_MODES: { value: CodeMode; label: string }[] = [
  { value: "threshold", label: "Selon le montant" },
  { value: "always", label: "Toujours" },
  { value: "never", label: "Jamais" },
]

export function SignatureSettingsCard({ mode = "app" }: { mode?: ShellMode }) {
  const demo = mode === "demo"
  const [available, setAvailable] = useState<boolean | null>(demo ? true : null)
  const [extras, setExtras] = useState(demo)
  const [access, setAccess] = useState(demo)
  // Démo : même acompte que sur la page de signature de démonstration
  const initial = demo ? { ...DEFAULT_SIGNATURE_SETTINGS, deposit_percent: DEMO_DEPOSIT_PERCENT } : DEFAULT_SIGNATURE_SETTINGS
  const [saved, setSaved] = useState<SignatureSettings>(initial)
  const [form, setForm] = useState({ ...initial, threshold: "5000", days: "30" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (demo) return
    fetch("/api/signature/settings")
      .then((r) => r.json())
      .then((json) => {
        if (!json.available) { setAvailable(false); return }
        setAvailable(true)
        setExtras(!!json.extras)
        setAccess(!!json.access)
        setSaved(json.settings)
        setForm({ ...json.settings, threshold: String(json.settings.code_threshold_ttc), days: String(json.settings.link_validity_days) })
      })
      .catch(() => setAvailable(false))
  }, [demo])

  if (!available) return null

  const dirty =
    form.enabled !== saved.enabled ||
    form.code_mode !== saved.code_mode ||
    Number(form.threshold) !== saved.code_threshold_ttc ||
    Number(form.days) !== saved.link_validity_days ||
    form.expiry_reminder_enabled !== saved.expiry_reminder_enabled ||
    form.expiry_reminder_days !== saved.expiry_reminder_days ||
    form.deposit_percent !== saved.deposit_percent

  const save = async () => {
    if (demo) {
      toast("Créez un compte pour régler la signature en ligne", {
        action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } },
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/signature/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          code_mode: form.code_mode,
          code_threshold_ttc: Number(form.threshold.replace(",", ".")),
          link_validity_days: Number(form.days),
          expiry_reminder_enabled: form.expiry_reminder_enabled,
          expiry_reminder_days: form.expiry_reminder_days,
          deposit_percent: form.deposit_percent,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Réglages non enregistrés"); return }
      setSaved(json.settings)
      setForm({ ...json.settings, threshold: String(json.settings.code_threshold_ttc), days: String(json.settings.link_validity_days) })
      toast.success("Signature en ligne enregistrée")
    } catch { toast.error("Erreur réseau") }
    finally { setSaving(false) }
  }

  return (
    <SettingsCard
      id="signature"
      title="Signature en ligne"
      description="Votre client lit le devis ou le bon de commande en entier, puis le signe en ligne : signature électronique simple, avec un dossier de preuve joint au PDF signé."
      action={!access ? <span className="q-pill q-pill-info shrink-0">Avec Essentiel</span> : undefined}
    >
      <SettingRow
        title="Proposer la signature en ligne"
        text={access ? "Les devis et bons de commande envoyés par email contiennent un lien « Consulter et signer »." : "Sans formule, vos devis partent avec un lien de consultation ; vous enregistrez l'accord de votre client à la main."}
      >
        <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} label="Proposer la signature en ligne" />
      </SettingRow>

      <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-3">
        <span className="q-label" id="code-mode-label">Code de vérification par email</span>
        <div className="q-seg self-start" role="radiogroup" aria-labelledby="code-mode-label">
          {CODE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={form.code_mode === m.value}
              className={form.code_mode === m.value ? "is-active" : undefined}
              onClick={() => setForm((f) => ({ ...f, code_mode: m.value }))}
            >
              {m.label}
            </button>
          ))}
        </div>
        {form.code_mode === "threshold" && (
          <label className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--q-text-3)]">
            Au-delà de
            <input
              inputMode="decimal"
              value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value.replace(/[^\d.,]/g, "") }))}
              className="q-input !w-[120px] text-right tabular-nums"
              aria-label="Montant TTC au-delà duquel un code est demandé"
            />
            € TTC
          </label>
        )}
        <p className="q-field-hint leading-relaxed">
          Un code à 6 chiffres part à l&apos;adresse email du client : il le saisit pour signer. Conseillé pour les gros montants.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-3">
        <label htmlFor="link-days" className="q-label">Validité d&apos;un lien de bon de commande</label>
        <span className="flex items-center gap-2 text-[14px] text-[var(--q-text-3)]">
          <input
            id="link-days"
            inputMode="numeric"
            value={form.days}
            onChange={(e) => setForm((f) => ({ ...f, days: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
            className="q-input !w-[90px] text-right tabular-nums"
          />
          jours
        </span>
        <p className="q-field-hint leading-relaxed">Un lien de devis expire avec la date de validité du devis.</p>
      </div>

      {extras && (
        <>
          <div className="flex flex-col gap-2">
            <SettingRow
              title="Relance avant expiration"
              text="Si votre client n'a ni signé ni refusé, il reçoit un rappel par email avant que le lien n'expire. Une seule fois par lien."
            >
              <Switch
                checked={form.expiry_reminder_enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, expiry_reminder_enabled: v }))}
                label="Relance avant expiration"
              />
            </SettingRow>
            {form.expiry_reminder_enabled && (
              <label className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--q-text-3)]">
                Envoyer
                <select
                  value={form.expiry_reminder_days}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_reminder_days: Number(e.target.value) }))}
                  className="q-input !w-auto"
                  aria-label="Jours avant l'expiration"
                >
                  {EXPIRY_REMINDER_DAY_CHOICES.map((d) => <option key={d} value={d}>{d} jour{d > 1 ? "s" : ""}</option>)}
                </select>
                avant l&apos;expiration
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--q-line-soft)] pt-3">
            <span className="q-label" id="deposit-label">Acompte demandé à la signature</span>
            <div className="q-seg self-start max-w-full max-sm:[&>button]:!px-2" role="radiogroup" aria-labelledby="deposit-label">
              {DEPOSIT_PERCENT_CHOICES.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  role="radio"
                  aria-checked={form.deposit_percent === pct}
                  className={form.deposit_percent === pct ? "is-active" : undefined}
                  onClick={() => setForm((f) => ({ ...f, deposit_percent: pct }))}
                >
                  {pct === 0 ? "Aucun" : `${pct} %`}
                </button>
              ))}
            </div>
            <p className="q-field-hint leading-relaxed">
              Après la signature, votre client voit le montant, votre IBAN et la référence du virement ; vous émettez la facture
              d&apos;acompte à réception. Signé sur place chez un particulier, la demande part 8 jours plus tard (aucun paiement avant 7 jours).
              Précisez dans vos conditions qu&apos;il s&apos;agit d&apos;un acompte : sans mention, la loi traite la somme versée par un
              particulier comme des arrhes (Code de la consommation, art. L214-1).
            </p>
          </div>
        </>
      )}

      <div className="flex justify-end border-t border-[var(--q-line-soft)] pt-3">
        <button type="button" onClick={save} disabled={saving || (!dirty && !demo)} className="q-btn q-btn-primary">
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </SettingsCard>
  )
}
