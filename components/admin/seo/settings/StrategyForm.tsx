"use client"

/**
 * Paramètres › Stratégie SEO (planche Parametres-strategie.dc.html) : niche,
 * objectif principal, objectifs cochés (grille de 3), description de l'activité.
 * L'objectif principal fait toujours partie des objectifs cochés (règle du schéma).
 */
import { useState } from "react"
import Link from "next/link"
import type { StrategyGoal, StrategySettings } from "@/lib/seo/settings"
import { CardFooter, Field, SaveButton, SelectBox, SettingsCard, UsedBy, describedBy } from "./ui"
import { useSettingsSave, useUnsavedGuard } from "./useSettingsSave"
import { errorFor, sameValue, withoutErrors } from "./validation"

const MAIN_GOAL_ERROR = "L'objectif principal doit faire partie des objectifs cochés"

function clean(v: StrategySettings, order: StrategyGoal[]): StrategySettings {
  return {
    niche: v.niche.trim(),
    mainGoal: v.mainGoal,
    // Ordre stable (celui de la liste) : cocher puis décocher ne compte pas comme une modification
    goals: order.filter((g) => v.goals.includes(g)),
    description: v.description.trim(),
  }
}

export function StrategyForm({
  initial,
  updatedAt,
  goals: goalOptions,
}: {
  initial: StrategySettings
  updatedAt: string | null
  goals: { key: StrategyGoal; label: string }[]
}) {
  const order = goalOptions.map((g) => g.key)
  const { baseline, errors, setErrors, savingCard, save } = useSettingsSave("strategy", initial, updatedAt)
  const [draft, setDraft] = useState<StrategySettings>(initial)
  const dirty = !sameValue(clean(draft, order), clean(baseline, order))
  useUnsavedGuard(dirty)

  const mainGoalMissing = !draft.goals.includes(draft.mainGoal)
  const goalsError = mainGoalMissing ? MAIN_GOAL_ERROR : errorFor(errors, "goals")

  function update(patch: Partial<StrategySettings>, fields: string[]) {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors(withoutErrors(errors, fields))
  }

  function toggleGoal(goal: StrategyGoal, checked: boolean) {
    const next = checked ? Array.from(new Set(draft.goals.concat(goal))) : draft.goals.filter((g) => g !== goal)
    update({ goals: next }, ["goals"])
  }

  async function onSave() {
    if (mainGoalMissing) return
    const next = await save("strategy", clean(draft, order), "Stratégie SEO enregistrée.")
    if (next) setDraft(next)
  }

  return (
    <SettingsCard
      id="titre-strategie"
      title="Stratégie SEO"
      bodyClassName="gap-5 pt-3"
      footer={
        <CardFooter>
          <UsedBy
            items={[
              { label: "génération d'articles", href: "/admin/seo/articles/liste?generer=1" },
              { label: "priorités de l'onglet Vue d'ensemble", href: "/admin/seo" },
            ]}
          />
          <SaveButton primary dirty={dirty && !mainGoalMissing} saving={savingCard === "strategy"} onClick={onSave} />
        </CardFooter>
      }
    >
      <Field id="niche" label="Niche" error={errorFor(errors, "niche")}>
        <input
          id="niche"
          type="text"
          className="q-input"
          value={draft.niche}
          maxLength={300}
          aria-invalid={Boolean(errorFor(errors, "niche")) || undefined}
          aria-describedby={describedBy("niche", undefined, errorFor(errors, "niche"))}
          onChange={(e) => update({ niche: e.target.value }, ["niche"])}
        />
      </Field>

      <Field id="objectif" label="Objectif principal" error={errorFor(errors, "mainGoal")}>
        <SelectBox
          id="objectif"
          value={draft.mainGoal}
          aria-invalid={Boolean(errorFor(errors, "mainGoal")) || undefined}
          onChange={(e) => {
            const goal = e.target.value as StrategyGoal
            // L'objectif principal est coché d'office
            update({ mainGoal: goal, goals: Array.from(new Set(draft.goals.concat(goal))) }, ["mainGoal", "goals"])
          }}
        >
          {goalOptions.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </SelectBox>
      </Field>

      <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={goalsError ? "objectifs-erreur" : "objectifs-aide"}>
        <legend className="q-label pb-2">Objectifs SEO</legend>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
          {goalOptions.map((g) => {
            const id = `obj-${g.key}`
            const checked = draft.goals.includes(g.key)
            return (
              <div key={g.key} className="flex min-h-[46px] items-center gap-2.5 rounded-[10px] border border-[var(--q-line)] bg-[var(--q-surface)] px-3">
                <input
                  id={id}
                  type="checkbox"
                  className="size-[18px] shrink-0 cursor-pointer accent-[var(--q-accent)]"
                  checked={checked}
                  onChange={(e) => toggleGoal(g.key, e.target.checked)}
                />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-2.5 text-sm font-medium leading-snug text-[var(--q-ink)]">
                  {g.label}
                  {g.key === draft.mainGoal && <span className="ml-1.5 text-xs font-normal text-[var(--q-text-4)]">(principal)</span>}
                </label>
              </div>
            )
          })}
        </div>
        <span id="objectifs-aide" className="q-field-hint mt-2 block">
          Les concurrents suivis se règlent dans{" "}
          <Link href="/admin/seo/parametres/ciblage" className="q-link">
            Ciblage
          </Link>
          .
        </span>
        {goalsError && (
          <span id="objectifs-erreur" role="alert" className="q-field-error mt-1 block">
            {goalsError}
          </span>
        )}
      </fieldset>

      <Field id="activite" label="Description de l'activité" error={errorFor(errors, "description")}>
        <textarea
          id="activite"
          rows={3}
          className="q-input"
          value={draft.description}
          maxLength={1500}
          aria-invalid={Boolean(errorFor(errors, "description")) || undefined}
          aria-describedby={describedBy("activite", undefined, errorFor(errors, "description"))}
          onChange={(e) => update({ description: e.target.value }, ["description"])}
        />
      </Field>
    </SettingsCard>
  )
}
