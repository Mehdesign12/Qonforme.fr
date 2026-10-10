"use client"

/**
 * Articles › Préférences (planche Articles-preferences) : Publication (cartes
 * radio), Rythme, Rédaction (modèles par passe avec prix indicatif et état de
 * la clé, longueur, FAQ, sources, angles, vouvoiement verrouillé), Image de
 * couverture (modèle et repli), Contrôle automatique, Liens automatiques.
 * « Enregistrer les préférences » : PUT /api/admin/seo/settings/articles.
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpRight, CalendarDays, Check, CircleAlert, CircleCheck, Info, Loader2, Lock, Save, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ArticleSettings } from "@/lib/seo/settings-schema"
import type { PublishMode } from "@/lib/seo/types"
import { PUBLISH_MODE_LABELS } from "@/lib/seo/types"
import type { ModelOption } from "@/lib/seo/articles/model-registry"
import { WEEKDAY_LABELS } from "@/lib/seo/articles/schedule"
import { api } from "@/components/admin/seo/articles/api"
import { Field, PUBLISH_MODE_HINTS, RadioCards, Select, type RadioOption } from "@/components/admin/seo/articles/fields"

const PUBLISH_OPTIONS: RadioOption<PublishMode>[] = (["draft", "after_check", "direct"] as PublishMode[]).map((value) => ({
  value,
  label: PUBLISH_MODE_LABELS[value].label,
  hint: PUBLISH_MODE_HINTS[value],
  ...(value === "draft" ? { badge: "Recommandé" } : {}),
}))

const PROVIDER_NAMES: Record<string, string> = { gemini: "Gemini", anthropic: "Anthropic" }

function Card({ id, title, text, children, aside }: { id: string; title: string; text?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="q-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-[18px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="q-h2">
            {title}
          </h2>
          {text && <p className="text-sm text-[var(--q-text-4)]">{text}</p>}
        </div>
        {aside}
      </div>
      <div className="px-5 pb-5 pt-4">{children}</div>
    </section>
  )
}

function ToggleRow({ id, label, hint, checked, onChange, locked, lockedNote }: { id: string; label: string; hint: string; checked: boolean; onChange?: (v: boolean) => void; locked?: boolean; lockedNote?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        {/* Toucher le libellé actionne l'interrupteur (cible plus grande que les 40 × 24 px du bouton) */}
        <label htmlFor={id} className={cn("text-sm font-semibold text-[var(--q-ink)]", !locked && "cursor-pointer")}>
          {label}
        </label>
        <span id={`${id}-aide`} className="text-[13px] text-[var(--q-text-4)]">
          {hint}
        </span>
        {lockedNote}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--q-text-3)]">
            <Lock className="size-3.5" aria-hidden />
            Verrouillé
          </span>
        )}
        <span className="grid min-h-11 min-w-11 place-items-center">
          <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-describedby={`${id}-aide`}
            aria-disabled={locked || undefined}
            onClick={() => !locked && onChange?.(!checked)}
            className={cn("q-switch", locked && "cursor-not-allowed")}
          />
        </span>
      </div>
    </div>
  )
}

function ModelSelect({
  id,
  label,
  value,
  options,
  onChange,
  fallbackNote,
}: {
  id: string
  label: string
  value: string
  options: ModelOption[]
  onChange: (v: string) => void
  /** Ce qui se passe si la clé du modèle manque. */
  fallbackNote?: string
}) {
  const current = options.find((o) => o.id === value)
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {!current && <option value={value}>{value} (ancien réglage)</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.available ? "" : " — clé absente"}
          </option>
        ))}
      </Select>
      {current && (
        <span className="flex flex-col gap-1 text-xs text-[var(--q-text-4)]">
          <span>{current.price}</span>
          {current.available ? (
            <span className="flex items-center gap-1.5">
              <CircleCheck className="size-3.5 text-[var(--q-ok)]" aria-hidden />
              <span>
                Connexion {PROVIDER_NAMES[current.provider] ?? current.provider} : clé présente ·{" "}
                <Link href="/admin/seo/parametres/connexions" className="q-link">
                  Connexions
                </Link>
              </span>
            </span>
          ) : (
            <span className="flex items-start gap-1.5 text-[var(--q-warn)]">
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                Clé {current.envKey} absente{fallbackNote ? ` : ${fallbackNote}` : ""} ·{" "}
                <Link href="/admin/seo/parametres/connexions" className="q-link">
                  Connexions
                </Link>
              </span>
            </span>
          )}
          {current.legacy && <span>{current.legacy}.</span>}
        </span>
      )}
    </Field>
  )
}

function NumberField({ id, label, value, onChange, min, max, step, suffix, error }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix: string; error?: string }) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-invalid={Boolean(error)}
          className="q-input pr-14 tabular-nums"
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-[var(--q-text-4)]">
          {suffix}
        </span>
      </div>
    </Field>
  )
}

export function PreferencesForm({
  initial,
  textModels,
  imageModels,
  auditRules,
}: {
  initial: ArticleSettings
  textModels: ModelOption[]
  imageModels: ModelOption[]
  auditRules: string[]
}) {
  const router = useRouter()
  const [v, setV] = useState<ArticleSettings>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof ArticleSettings>(key: K, value: ArticleSettings[K]) => setV((prev) => ({ ...prev, [key]: value }))

  const planLabel = textModels.find((m) => m.id === v.planModel)?.label ?? v.planModel
  const image = imageModels.find((m) => m.id === v.imageModel)
  const fallbackImage = image?.fallback ? imageModels.find((m) => m.id === image.fallback) : null
  const shownRules = auditRules.slice(0, 6)

  async function save() {
    setBusy(true)
    setError(null)
    setFieldErrors({})
    const res = await api<{ ok: boolean }>("/api/admin/seo/settings/articles", "PUT", { value: v })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      setFieldErrors(res.fieldErrors ?? {})
      return
    }
    toast.success("Préférences enregistrées")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <Card id="t-publication" title="Publication" text="Choisissez ce qui se passe quand un article est rédigé.">
        <RadioCards name="pub" legend="Mode de publication" legendHidden value={v.publishMode} options={PUBLISH_OPTIONS} onChange={(m) => set("publishMode", m)} columns describedBy="pub-note" />
        <p id="pub-note" className="mt-3.5 flex items-start gap-2 text-[13px] text-[var(--q-text-3)]">
          <ShieldCheck className="mt-px size-4 shrink-0 text-[var(--q-ok)]" aria-hidden />
          <span>Le contrôle automatique retient toujours un article qui cite une valeur périmée ou une affirmation interdite.</span>
        </p>
      </Card>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          <Card id="t-rythme" title="Rythme" text="Le créneau des articles que vous ne planifiez pas à la main.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fréquence" htmlFor="rythme-frequence" error={fieldErrors.perWeek}>
                <Select id="rythme-frequence" value={String(v.perWeek)} onChange={(e) => set("perWeek", Number(e.target.value))}>
                  <option value="0">Aucun créneau automatique</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} article{n > 1 ? "s" : ""} par semaine
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Jour" htmlFor="rythme-jour" error={fieldErrors.weekday} hint={v.perWeek > 1 ? "Premier jour de la semaine ; les suivants sont répartis." : undefined}>
                <Select id="rythme-jour" value={String(v.weekday)} onChange={(e) => set("weekday", Number(e.target.value))}>
                  {WEEKDAY_LABELS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Heure" htmlFor="rythme-heure" error={fieldErrors.time}>
                <input id="rythme-heure" type="time" step={900} className="q-input" value={v.time} onChange={(e) => set("time", e.target.value)} />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="q-label">Fuseau</span>
                <span className="flex min-h-[42px] items-center text-[15px] text-[var(--q-text-2)]">Paris</span>
              </div>
            </div>
            <p className="mt-3.5 flex items-center gap-2 text-[13px] text-[var(--q-text-3)]">
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              <span>Les sujets planifiés à la main gardent leur date.</span>
            </p>
          </Card>

          <Card id="t-redaction" title="Rédaction" text="Les modèles, la longueur et la structure de chaque article.">
            <div className="flex flex-col gap-4">
              <ModelSelect id="redac-plan" label="Plan" value={v.planModel} options={textModels} onChange={(m) => set("planModel", m)} fallbackNote="la rédaction ne peut pas démarrer" />
              <ModelSelect id="redac-texte" label="Rédaction (et correction)" value={v.textModel} options={textModels} onChange={(m) => set("textModel", m)} fallbackNote={`repli automatique sur ${planLabel}`} />
              <ModelSelect id="redac-controle" label="Contrôle factuel" value={v.reviewModel} options={textModels} onChange={(m) => set("reviewModel", m)} fallbackNote={`repli automatique sur ${planLabel}`} />
              {v.reviewModel === v.textModel && (
                <p className="flex items-start gap-2 text-[13px] text-[var(--q-text-3)]">
                  <Info className="mt-px size-4 shrink-0" aria-hidden />
                  <span>Le contrôle relit mieux quand il est confié à un autre modèle que la rédaction.</span>
                </p>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[var(--q-line-soft)] pt-4 sm:grid-cols-2">
              <NumberField id="redac-min" label="Longueur minimale" value={v.lengthMin} onChange={(n) => set("lengthMin", n)} min={600} max={4000} step={100} suffix="mots" error={fieldErrors.lengthMin} />
              <NumberField id="redac-max" label="Longueur maximale" value={v.lengthMax} onChange={(n) => set("lengthMax", n)} min={800} max={5000} step={100} suffix="mots" error={fieldErrors.lengthMax} />
            </div>
            <div className="mt-4 flex flex-col divide-y divide-[var(--q-line-soft)] border-t border-[var(--q-line-soft)] pt-4">
              <ToggleRow id="pref-faq" label={`FAQ de ${v.faqMin} à ${v.faqMax} questions`} hint="Questions fréquentes de vos lecteurs, en fin d'article." checked={v.faq} onChange={(b) => set("faq", b)} />
              {v.faq && (
                <div className="grid grid-cols-2 gap-4 py-3">
                  <NumberField id="faq-min" label="Questions, au moins" value={v.faqMin} onChange={(n) => set("faqMin", n)} min={1} max={10} step={1} suffix="" error={fieldErrors.faqMin} />
                  <NumberField id="faq-max" label="Questions, au plus" value={v.faqMax} onChange={(n) => set("faqMax", n)} min={1} max={12} step={1} suffix="" error={fieldErrors.faqMax} />
                </div>
              )}
              <ToggleRow id="pref-conclusion" label="Conclusion avec appel à essayer Qonforme" hint="Dernière section de l'article, sans promesse invérifiable." checked locked />
              <ToggleRow
                id="pref-sources"
                label="Sources officielles à citer"
                hint="Légifrance, service-public.gouv.fr, impots.gouv.fr : chaque règle légale renvoie à son texte."
                checked={v.officialSources}
                onChange={(b) => set("officialSources", b)}
              />
              <ToggleRow id="pref-angles" label="Angles éditoriaux alternés" hint="8 angles, alternés d'un article à l'autre." checked={v.alternateAngles} onChange={(b) => set("alternateAngles", b)} />
              <ToggleRow
                id="pref-vouvoiement"
                label="Vouvoiement"
                hint="Toujours activé : le ton de marque l'impose."
                checked
                locked
                lockedNote={
                  <Link href="/admin/seo/parametres" className="q-link inline-flex min-h-11 items-center text-[13px] md:min-h-0">
                    Voir le ton de marque
                  </Link>
                }
              />
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          <Card id="t-image" title="Image de couverture" text="Choisissez si une image de couverture est générée avec chaque article.">
            <ToggleRow id="pref-image" label="Générer une image de couverture" hint="Photo d'artisan du bâtiment au travail, sans texte ni logo, 16:9, créée au moment de la rédaction." checked={v.coverImage} onChange={(b) => set("coverImage", b)} />
            <div className="mt-3.5 border-t border-[var(--q-line-soft)] pt-3.5">
              <ModelSelect id="image-modele" label="Modèle d'image" value={v.imageModel} options={imageModels} onChange={(m) => set("imageModel", m)} />
              {fallbackImage && (
                <p className="mt-2 flex items-start gap-2 text-[13px] text-[var(--q-text-3)]">
                  <Info className="mt-px size-4 shrink-0" aria-hidden />
                  <span>
                    Repli automatique : si {image?.label} échoue, l&apos;image est demandée à {fallbackImage.label} ; le modèle réellement utilisé est noté sur l&apos;article.
                  </span>
                </p>
              )}
              <p className="mt-2 text-[13px] text-[var(--q-text-4)]">Une image qui échoue n&apos;empêche jamais l&apos;article.</p>
            </div>
          </Card>

          <Card
            id="t-controle"
            title="Contrôle automatique"
            text="Vérifie chaque article avant sa publication."
            aside={
              <span className="q-pill q-pill-ok shrink-0">
                <Check strokeWidth={2.75} aria-hidden />
                {auditRules.length} règles actives
              </span>
            }
          >
            <span className="mb-2 block text-[13px] font-semibold text-[var(--q-ink)]">Exemples de contrôles</span>
            <div className="flex flex-wrap gap-1.5">
              {shownRules.map((r) => (
                <span key={r} className="q-tag !h-auto min-h-[22px] py-0.5">
                  {r}
                </span>
              ))}
              {auditRules.length > shownRules.length && (
                <span className="q-tag !h-auto min-h-[22px] py-0.5">
                  + {auditRules.length - shownRules.length} autre{auditRules.length - shownRules.length > 1 ? "s" : ""} règle{auditRules.length - shownRules.length > 1 ? "s" : ""}, visibles dans la vérification du blog
                </span>
              )}
            </div>
            <p className="mt-3 text-[13px] text-[var(--q-text-3)]">
              S&apos;y ajoutent la relecture factuelle par le modèle de contrôle, les concurrents nommés, la longueur, les titres répétés, les liens non officiels et les doublons.
            </p>
            <div className="mt-4 border-t border-[var(--q-line-soft)] pt-3.5">
              <Link href="/admin/blog/verification" className="q-link inline-flex min-h-11 items-center gap-1.5 text-sm md:min-h-0">
                Voir la vérification du blog
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </div>
          </Card>

          <Card id="t-liens" title="Liens automatiques vers les guides" text="Relient vos articles à vos guides pour renforcer le maillage interne.">
            <ToggleRow
              id="pref-liens"
              label="Ajouter les liens à chaque article"
              hint="Par exemple, « faire un devis » ou « taux de TVA des travaux » renvoient vers le guide qui y répond."
              checked={v.autoLinks}
              onChange={(b) => set("autoLinks", b)}
            />
          </Card>
        </div>
      </div>

      <div className="q-card flex flex-col gap-3 px-5 py-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <p className="flex min-w-0 items-start gap-2 text-[13px] text-[var(--q-text-3)]">
          <Info className="mt-px size-4 shrink-0" aria-hidden />
          <span>Les préférences s&apos;appliquent aux prochains articles ; les articles déjà rédigés ne changent pas.</span>
        </p>
        <div className="flex flex-col gap-2 md:items-end">
          {error && (
            <p role="alert" className="q-field-error !text-[13px]">
              {error}
            </p>
          )}
          <button type="button" onClick={save} disabled={busy} className={cn("q-btn q-btn-primary max-md:q-btn-lg max-md:w-full")}>
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Save aria-hidden />}
            Enregistrer les préférences
          </button>
        </div>
      </div>
    </div>
  )
}
