"use client"

/**
 * Paramètres › Contexte de marque (planche Parametres-marque.dc.html) :
 * carte « Contexte de marque » (Enregistrer primaire) et carte « Preuves »
 * (5 au plus, modification en place, Enregistrer secondaire).
 * Le contexte sert à la génération d'articles et au suivi de la visibilité IA.
 */
import { useRef, useState } from "react"
import { ExternalLink, Info, Pencil, Plus, X } from "lucide-react"
import type { BrandSettings } from "@/lib/seo/settings"
import { fmtDate } from "@/components/admin/ui"
import { cn } from "@/lib/utils"
import { CardFooter, Field, SaveButton, SettingsCard, StatusLine, UsedBy, describedBy } from "./ui"
import { useSettingsSave, useUnsavedGuard } from "./useSettingsSave"
import { useFocusAfterRender } from "./useFocusAfterRender"
import {
  errorFor,
  linesError,
  linesToList,
  listToLines,
  pick,
  proofErrors,
  safeExternalUrl,
  sameValue,
  withoutErrors,
  type ProofDraft,
} from "./validation"

const MAIN_FIELDS = ["name", "audience", "offer", "benefits", "positioning", "tone"] as const
type MainField = (typeof MAIN_FIELDS)[number]

type MainDraft = Omit<Pick<BrandSettings, MainField>, "benefits"> & { benefitsText: string }

function mainDraftOf(v: BrandSettings): MainDraft {
  return {
    name: v.name,
    audience: v.audience,
    offer: v.offer,
    benefitsText: listToLines(v.benefits),
    positioning: v.positioning,
    tone: v.tone,
  }
}

function mainValueOf(d: MainDraft): Pick<BrandSettings, MainField> {
  return {
    name: d.name.trim(),
    audience: d.audience.trim(),
    offer: d.offer.trim(),
    benefits: linesToList(d.benefitsText),
    positioning: d.positioning.trim(),
    tone: d.tone.trim(),
  }
}

function cleanProof(p: ProofDraft): ProofDraft {
  return { claim: p.claim.trim(), source: p.source.trim(), url: p.url.trim() }
}

const UTILISE_PAR = [
  { label: "génération d'articles", href: "/admin/seo/articles/liste?generer=1" },
  { label: "suivi de la visibilité IA", href: "/admin/seo/visibilite-ia?suivi=1" },
]

export function BrandForm({
  initial,
  saved,
  updatedAt: initialUpdatedAt,
  maxProofs,
}: {
  initial: BrandSettings
  saved: boolean
  updatedAt: string | null
  maxProofs: number
}) {
  const { baseline, updatedAt, errors, setErrors, savingCard, busy, save } = useSettingsSave("brand", initial, initialUpdatedAt)
  const focusAfterRender = useFocusAfterRender()
  const editButtons = useRef<(HTMLButtonElement | null)[]>([])
  const removeButtons = useRef<(HTMLButtonElement | null)[]>([])
  const addButton = useRef<HTMLButtonElement | null>(null)
  const [main, setMain] = useState<MainDraft>(() => mainDraftOf(initial))
  const [proofs, setProofs] = useState<ProofDraft[]>(() => initial.proofs.map((p) => ({ ...p })))
  const [editing, setEditing] = useState<{ index: number; draft: ProofDraft; isNew: boolean } | null>(null)
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof ProofDraft, string>>>({})

  const mainDirty = !sameValue(mainValueOf(main), pick(baseline, MAIN_FIELDS))
  const editingDirty = editing !== null && !sameValue(cleanProof(editing.draft), editing.isNew ? null : cleanProof(proofs[editing.index]))
  const proofsDirty = !sameValue(proofs.map(cleanProof), baseline.proofs) || editingDirty
  useUnsavedGuard(mainDirty || proofsDirty)

  const isSaved = saved || updatedAt !== initialUpdatedAt

  function setField<K extends keyof MainDraft>(key: K, value: MainDraft[K]) {
    setMain((m) => ({ ...m, [key]: value }))
    const field = key === "benefitsText" ? "benefits" : key
    if (errorFor(errors, field)) setErrors(withoutErrors(errors, [field]))
  }

  async function saveMain() {
    const local: Record<string, string> = {}
    const benefits = linesError(linesToList(main.benefitsText), { max: 10, maxLength: 300, noun: "bénéfices" })
    if (benefits) local.benefits = benefits
    if (!main.name.trim()) local.name = "Le nom de la marque est obligatoire"
    if (Object.keys(local).length > 0) {
      setErrors({ ...errors, ...local })
      return
    }
    const value: BrandSettings = { ...baseline, ...mainValueOf(main) }
    const next = await save("main", value, "Contexte de marque enregistré.")
    if (next) setMain(mainDraftOf(next))
  }

  /* ---------------- Preuves ---------------- */

  function startEdit(index: number) {
    setEditing({ index, draft: { ...proofs[index] }, isNew: false })
    setEditErrors({})
  }

  function addProof() {
    if (proofs.length >= maxProofs || editing) return
    setEditing({ index: proofs.length, draft: { claim: "", source: "", url: "" }, isNew: true })
    setEditErrors({})
  }

  /**
   * Valide la preuve en cours de modification ; rend la liste à jour, ou null
   * si elle est invalide. Avec `moveFocus`, le focus passe au bouton
   * « Modifier » de la preuve validée (l'éditeur disparaît).
   */
  function commitEdit(moveFocus = false): ProofDraft[] | null {
    if (!editing) return proofs
    const errs = proofErrors(editing.draft)
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs)
      return null
    }
    const next = proofs.slice()
    if (editing.isNew) next.push(cleanProof(editing.draft))
    else next[editing.index] = cleanProof(editing.draft)
    const index = editing.isNew ? next.length - 1 : editing.index
    if (moveFocus) focusAfterRender(() => editButtons.current[index])
    setProofs(next)
    setEditing(null)
    setEditErrors({})
    setErrors(withoutErrors(errors, ["proofs"]))
    return next
  }

  /** Annule : focus au bouton « Modifier » de la preuve, ou à « Ajouter une preuve » pour un ajout. */
  function cancelEdit() {
    if (editing) {
      const { index, isNew } = editing
      focusAfterRender(() => (isNew ? addButton.current : editButtons.current[index]))
    }
    setEditing(null)
    setEditErrors({})
  }

  /** Retire une preuve : focus au « Retirer » suivant, sinon au précédent, sinon à « Ajouter une preuve ». */
  function removeProof(index: number) {
    if (editing && editing.index === index) setEditing(null)
    const remaining = proofs.length - 1
    focusAfterRender(() =>
      remaining === 0 ? addButton.current : removeButtons.current[Math.min(index, remaining - 1)] ?? addButton.current,
    )
    setProofs((list) => list.filter((_, i) => i !== index))
    setErrors(withoutErrors(errors, ["proofs"]))
  }

  async function saveProofs() {
    const list = commitEdit()
    if (!list) return
    const value: BrandSettings = { ...baseline, proofs: list.map(cleanProof) }
    const next = await save("proofs", value, "Preuves enregistrées.")
    if (next) setProofs(next.proofs.map((p) => ({ ...p })))
  }

  const proofsError = errorFor(errors, "proofs")
  const benefitsError = errorFor(errors, "benefits", "Ligne")
  const full = proofs.length >= maxProofs
  const shownCount = proofs.length + (editing?.isNew ? 1 : 0)

  return (
    <>
      <SettingsCard
        id="titre-marque"
        title="Contexte de marque"
        footer={
          <CardFooter>
            <UsedBy items={UTILISE_PAR} />
            <SaveButton primary dirty={mainDirty} saving={savingCard === "main"} busy={busy} onClick={saveMain} />
          </CardFooter>
        }
      >
        {isSaved ? (
          <StatusLine tone="ok">Contexte vérifié — enregistré le {fmtDate(updatedAt)}</StatusLine>
        ) : (
          <StatusLine tone="info">Valeurs par défaut — pas encore enregistrées</StatusLine>
        )}

        <div className="grid items-start gap-x-5 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          <Field id="marque-nom" label="Nom de la marque" error={errorFor(errors, "name")}>
            <input
              id="marque-nom"
              type="text"
              className="q-input"
              value={main.name}
              maxLength={80}
              required
              aria-invalid={Boolean(errorFor(errors, "name")) || undefined}
              aria-describedby={describedBy("marque-nom", undefined, errorFor(errors, "name"))}
              onChange={(e) => setField("name", e.target.value)}
            />
          </Field>

          <Field id="marque-audience" label="Audience cible" error={errorFor(errors, "audience")}>
            <textarea
              id="marque-audience"
              rows={3}
              className="q-input"
              value={main.audience}
              maxLength={600}
              aria-invalid={Boolean(errorFor(errors, "audience")) || undefined}
              aria-describedby={describedBy("marque-audience", undefined, errorFor(errors, "audience"))}
              onChange={(e) => setField("audience", e.target.value)}
            />
          </Field>

          <Field id="marque-offre" label="Offre principale" className="col-span-full" error={errorFor(errors, "offer")}>
            <textarea
              id="marque-offre"
              rows={2}
              className="q-input min-h-[80px]"
              value={main.offer}
              maxLength={1000}
              aria-invalid={Boolean(errorFor(errors, "offer")) || undefined}
              aria-describedby={describedBy("marque-offre", undefined, errorFor(errors, "offer"))}
              onChange={(e) => setField("offer", e.target.value)}
            />
          </Field>

          <Field id="marque-benefices" label="Bénéfices clés" className="col-span-full" hint="Un bénéfice par ligne." error={benefitsError}>
            <textarea
              id="marque-benefices"
              rows={4}
              className="q-input min-h-[116px]"
              value={main.benefitsText}
              aria-invalid={Boolean(benefitsError) || undefined}
              aria-describedby={describedBy("marque-benefices", "aide", benefitsError)}
              onChange={(e) => setField("benefitsText", e.target.value)}
            />
          </Field>

          <Field id="marque-positionnement" label="Positionnement" error={errorFor(errors, "positioning")}>
            <textarea
              id="marque-positionnement"
              rows={5}
              className="q-input min-h-[140px]"
              value={main.positioning}
              maxLength={1000}
              aria-invalid={Boolean(errorFor(errors, "positioning")) || undefined}
              aria-describedby={describedBy("marque-positionnement", undefined, errorFor(errors, "positioning"))}
              onChange={(e) => setField("positioning", e.target.value)}
            />
          </Field>

          <Field id="marque-ton" label="Ton de marque" error={errorFor(errors, "tone")}>
            <textarea
              id="marque-ton"
              rows={5}
              className="q-input min-h-[140px]"
              value={main.tone}
              maxLength={600}
              aria-invalid={Boolean(errorFor(errors, "tone")) || undefined}
              aria-describedby={describedBy("marque-ton", undefined, errorFor(errors, "tone"))}
              onChange={(e) => setField("tone", e.target.value)}
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        id="titre-preuves"
        title="Preuves"
        action={
          <span className="q-pill q-pill-neutral tabular-nums">
            {shownCount} sur {maxProofs}
          </span>
        }
        footer={
          <CardFooter>
            <p id="limite-preuves" className="flex items-center gap-2 text-[13px] text-[var(--q-text-4)]">
              <Info className="size-4 shrink-0" aria-hidden />
              <span>
                {full
                  ? `${maxProofs} preuves au maximum : retirez-en une pour en ajouter une autre.`
                  : `${maxProofs} preuves au maximum, chacune avec sa source.`}
              </span>
            </p>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <button
                ref={addButton}
                type="button"
                onClick={addProof}
                disabled={full || editing !== null}
                aria-describedby="limite-preuves"
                className="q-btn q-btn-secondary h-12 w-full rounded-[14px] text-[15px] md:h-10 md:w-auto md:rounded-[10px] md:text-sm"
              >
                <Plus aria-hidden />
                Ajouter une preuve
              </button>
              <SaveButton
                dirty={proofsDirty}
                saving={savingCard === "proofs"}
                busy={busy}
                onClick={saveProofs}
                ariaLabel="Enregistrer les preuves"
              />
            </div>
          </CardFooter>
        }
        bodyClassName="gap-0 pb-0"
      >
        {proofsError && (
          <p role="alert" className="q-field-error pb-2">
            {proofsError}
          </p>
        )}
        {proofs.length === 0 && !editing ? (
          <p className="border-t border-[var(--q-line-soft)] py-4 text-sm text-[var(--q-text-4)]">
            Aucune preuve : ajoutez des affirmations vérifiables, chacune avec sa source officielle.
          </p>
        ) : (
          <ul className="mt-2">
            {proofs.map((proof, index) =>
              editing && !editing.isNew && editing.index === index ? (
                <li key={index} className="border-t border-[var(--q-line-soft)] py-3.5">
                  <ProofEditor
                    index={index}
                    draft={editing.draft}
                    errors={editErrors}
                    onChange={(draft) => setEditing({ ...editing, draft })}
                    onCommit={() => commitEdit(true)}
                    onCancel={cancelEdit}
                  />
                </li>
              ) : (
                <ProofRow
                  key={index}
                  index={index}
                  proof={proof}
                  error={errorFor(errors, `proofs.${index}`)}
                  disabled={editing !== null}
                  editRef={(el) => {
                    editButtons.current[index] = el
                  }}
                  removeRef={(el) => {
                    removeButtons.current[index] = el
                  }}
                  onEdit={() => startEdit(index)}
                  onRemove={() => removeProof(index)}
                />
              ),
            )}
            {editing?.isNew && (
              <li className="border-t border-[var(--q-line-soft)] py-3.5">
                <ProofEditor
                  index={editing.index}
                  isNew
                  draft={editing.draft}
                  errors={editErrors}
                  onChange={(draft) => setEditing({ ...editing, draft })}
                  onCommit={() => commitEdit(true)}
                  onCancel={cancelEdit}
                />
              </li>
            )}
          </ul>
        )}
      </SettingsCard>
    </>
  )
}

function ProofRow({
  index,
  proof,
  error,
  disabled,
  editRef,
  removeRef,
  onEdit,
  onRemove,
}: {
  index: number
  proof: ProofDraft
  error: string | null
  disabled: boolean
  editRef: (el: HTMLButtonElement | null) => void
  removeRef: (el: HTMLButtonElement | null) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const href = safeExternalUrl(proof.url)
  return (
    <li className="flex items-center gap-4 border-t border-[var(--q-line-soft)] py-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-[var(--q-ink)]">{proof.claim}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--q-text-4)]">
          Source&nbsp;:{" "}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${proof.source} (s'ouvre dans un nouvel onglet)`}
              className="inline-flex items-center gap-1 font-semibold text-[var(--q-accent-strong)] hover:text-[var(--q-accent-ink)]"
            >
              {proof.source}
              <ExternalLink className="size-[13px] shrink-0" aria-hidden />
            </a>
          ) : (
            <span className="font-semibold text-[var(--q-text-2)]">{proof.source}</span>
          )}
        </p>
        {error && (
          <p role="alert" className="q-field-error">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          ref={editRef}
          type="button"
          onClick={onEdit}
          disabled={disabled}
          aria-label={`Modifier la preuve ${index + 1}`}
          className="q-btn q-btn-ghost q-btn-icon size-11 md:size-[34px]"
        >
          <Pencil aria-hidden />
        </button>
        <button
          ref={removeRef}
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Retirer la preuve ${index + 1}`}
          className="q-btn q-btn-ghost q-btn-icon size-11 md:size-[34px]"
        >
          <X aria-hidden />
        </button>
      </div>
    </li>
  )
}

function ProofEditor({
  index,
  isNew = false,
  draft,
  errors,
  onChange,
  onCommit,
  onCancel,
}: {
  index: number
  isNew?: boolean
  draft: ProofDraft
  errors: Partial<Record<keyof ProofDraft, string>>
  onChange: (draft: ProofDraft) => void
  onCommit: () => void
  onCancel: () => void
}) {
  const base = `preuve-${index}`
  return (
    <div
      role="group"
      aria-label={isNew ? "Nouvelle preuve" : `Modifier la preuve ${index + 1}`}
      className="flex flex-col gap-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel()
      }}
    >
      <Field id={`${base}-affirmation`} label="Affirmation" error={errors.claim}>
        <textarea
          id={`${base}-affirmation`}
          rows={2}
          className="q-input min-h-[64px]"
          value={draft.claim}
          maxLength={300}
          autoFocus
          aria-invalid={Boolean(errors.claim) || undefined}
          aria-describedby={describedBy(`${base}-affirmation`, undefined, errors.claim)}
          onChange={(e) => onChange({ ...draft, claim: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field id={`${base}-source`} label="Source" hint="Texte officiel ou site public, par exemple « Légifrance, CGI art. 293 B »." error={errors.source}>
          <input
            id={`${base}-source`}
            type="text"
            className="q-input"
            value={draft.source}
            maxLength={200}
            aria-invalid={Boolean(errors.source) || undefined}
            aria-describedby={describedBy(`${base}-source`, "aide", errors.source)}
            onChange={(e) => onChange({ ...draft, source: e.target.value })}
          />
        </Field>
        <Field id={`${base}-lien`} label="Lien de la source (facultatif)" hint="Adresse complète, en https://." error={errors.url}>
          <input
            id={`${base}-lien`}
            type="url"
            inputMode="url"
            className="q-input"
            value={draft.url}
            maxLength={500}
            placeholder="https://"
            aria-invalid={Boolean(errors.url) || undefined}
            aria-describedby={describedBy(`${base}-lien`, "aide", errors.url)}
            onChange={(e) => onChange({ ...draft, url: e.target.value })}
          />
        </Field>
      </div>
      <div className={cn("flex flex-col-reverse gap-2 md:flex-row md:justify-end")}>
        <button type="button" onClick={onCancel} className="q-btn q-btn-ghost h-12 w-full md:h-[34px] md:w-auto md:px-3 md:text-[13px]">
          Annuler
        </button>
        <button type="button" onClick={onCommit} className="q-btn q-btn-secondary h-12 w-full md:h-[34px] md:w-auto md:px-3 md:text-[13px]">
          {isNew ? "Ajouter à la liste" : "Valider la preuve"}
        </button>
      </div>
    </div>
  )
}
