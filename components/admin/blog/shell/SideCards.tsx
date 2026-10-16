"use client"

/**
 * Cartes de la colonne de droite de l'éditeur d'articles (≥ 1 280 px ; sous
 * cette largeur, onglets « Référencement » et « Publication ») : Publication,
 * Score SEO, Mot-clé principal, Résultat Google, Adresse, Mots-clés
 * secondaires, Plan de l'article. Cartes compactes (q-card, 16 px de marge
 * intérieure, titre 14 px avec son icône, action à droite).
 *
 * Les composants du référencement (components/admin/blog/seo/*) sont
 * utilisés tels quels ; ici, seulement leur assemblage, les champs Google et
 * l'adresse. Chaque champ porte data-focus-target (liste de contrôle → champ).
 */
import { useId } from "react"
import { CalendarClock, ListTree, Gauge, Link2, Loader2, RefreshCw, Save, Search, Send, Tags, Target, TriangleAlert, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUGGEST_FIELDS } from "@/lib/seo/articles/suggest"
import { CharMeter } from "@/components/admin/blog/seo/CharMeter"
import { KeywordPicker } from "@/components/admin/blog/seo/KeywordPicker"
import { PublicationPanel, type PublicationValue } from "@/components/admin/blog/seo/PublicationPanel"
import { SecondaryKeywords } from "@/components/admin/blog/seo/SecondaryKeywords"
import { SeoScore } from "@/components/admin/blog/seo/SeoScore"
import { SerpPreview } from "@/components/admin/blog/seo/SerpPreview"
import { SuggestButton, SuggestionList, type SuggestController } from "@/components/admin/blog/seo/SuggestButton"
import { AutoTextarea, FLASH_RING, SideCard } from "@/components/admin/blog/shell/parts"
import type { SeoContextState } from "@/components/admin/blog/seo/useSeoContext"
import type { OnPageResult, OnPageTarget } from "@/lib/seo/articles/onpage"

/** Bloc d'un champ : anneau de la liste de contrôle, sans décaler la mise en page. */
const FIELD_BLOCK = cn(FLASH_RING, "-mx-1.5 flex flex-col gap-1.5 px-1.5 py-1")

const nf = (n: number) => n.toLocaleString("fr-FR")

/* ------------------------------------------------------------------ */
/* Publication                                                         */
/* ------------------------------------------------------------------ */

export function PublicationCard({
  value,
  onChange,
  isPublished,
  publishedAt,
  slug,
  defaultTime,
  saving,
  saveLabel,
  onSave,
  note,
  className,
}: {
  value: PublicationValue
  onChange: (next: PublicationValue) => void
  isPublished: boolean
  publishedAt: string | null
  slug: string
  defaultTime: string
  saving: boolean
  saveLabel: string
  onSave: () => void
  /** Au-dessus du choix : heure proposée à confirmer. */
  note?: React.ReactNode
  className?: string
}) {
  const icon =
    saving ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : saveLabel === "Publier maintenant" ? <Send aria-hidden /> : saveLabel.startsWith("Programmer") ? <CalendarClock aria-hidden /> : saveLabel === "Retirer du blog" ? <Undo2 aria-hidden /> : <Save aria-hidden />
  return (
    <SideCard id="carte-publication" icon={<Send />} title="Publication" className={className}>
      {note}
      <div data-focus-target="publication" className={cn(FLASH_RING, "-m-1.5 p-1.5")}>
        <PublicationPanel
          idPrefix="blog-pub"
          mode={value.mode}
          day={value.day}
          time={value.time}
          onChange={onChange}
          isPublished={isPublished}
          publishedAt={publishedAt}
          slug={slug}
          defaultTime={defaultTime}
          footer={
            <button type="button" onClick={onSave} disabled={saving} className="q-btn q-btn-primary mt-1 w-full max-md:h-12">
              {icon}
              {saving ? "Enregistrement…" : saveLabel}
            </button>
          }
        />
      </div>
    </SideCard>
  )
}

/* ------------------------------------------------------------------ */
/* Score                                                               */
/* ------------------------------------------------------------------ */

export function ScoreCard({ result, onFocusTarget, className }: { result: OnPageResult; onFocusTarget: (target: OnPageTarget) => void; className?: string }) {
  return (
    <SideCard id="carte-score" icon={<Gauge />} title="Score SEO" className={className}>
      <SeoScore result={result} onFocusTarget={onFocusTarget} />
    </SideCard>
  )
}

/* ------------------------------------------------------------------ */
/* Mot-clé principal                                                   */
/* ------------------------------------------------------------------ */

export function KeywordCard({
  value,
  onChange,
  seo,
  slug,
  selfId,
  className,
}: {
  value: string | null
  onChange: (keyword: string | null) => void
  seo: SeoContextState
  slug: string
  selfId: string | null
  className?: string
}) {
  return (
    <SideCard id="carte-mot-cle" icon={<Target />} title="Mot-clé principal" className={className}>
      <div data-focus-target="keyword" className={cn(FLASH_RING, "-m-1.5 p-1.5")}>
        <KeywordPicker
          inputId="blog-keyword"
          value={value}
          onChange={onChange}
          keywords={seo.data?.keywords ?? null}
          keywordPages={seo.data?.keywordPages ?? null}
          loading={seo.loading}
          error={seo.error}
          onRetry={seo.reload}
          slug={slug}
          selfId={selfId}
          gscConnected={seo.data?.gsc.connected ?? true}
        />
      </div>
    </SideCard>
  )
}

/* ------------------------------------------------------------------ */
/* Résultat Google                                                     */
/* ------------------------------------------------------------------ */

export function GoogleCard({
  seoTitle,
  seoDescription,
  title,
  excerpt,
  slug,
  date,
  onSeoTitleChange,
  onSeoDescriptionChange,
  suggestTitle,
  suggestDescription,
  className,
}: {
  seoTitle: string
  seoDescription: string
  /** Titre et chapeau de l'article : repris quand les champs Google sont vides. */
  title: string
  excerpt: string
  slug: string
  /** Date affichée dans l'aperçu (publication ou date prévue). */
  date: string | null
  onSeoTitleChange: (value: string) => void
  onSeoDescriptionChange: (value: string) => void
  suggestTitle: SuggestController
  suggestDescription: SuggestController
  className?: string
}) {
  const uid = useId()
  const titleDef = SUGGEST_FIELDS.seoTitle
  const descDef = SUGGEST_FIELDS.seoDescription
  const effectiveTitle = (seoTitle.trim() || title.trim()).replace(/\s+/g, " ")
  const effectiveDescription = (seoDescription.trim() || excerpt.trim()).replace(/\s+/g, " ")

  return (
    <SideCard id="carte-google" icon={<Search />} title="Résultat Google" className={className} bodyClassName="flex flex-col gap-4">
      <div data-focus-target="seoTitle" className={FIELD_BLOCK}>
        <div className="flex min-h-8 items-center justify-between gap-2">
          <label htmlFor="blog-seo-title" className="q-label">
            Titre
          </label>
          <SuggestButton suggest={suggestTitle} className="-mr-2" />
        </div>
        <input
          id="blog-seo-title"
          type="text"
          value={seoTitle}
          onChange={(e) => onSeoTitleChange(e.target.value)}
          maxLength={200}
          spellCheck
          lang="fr"
          placeholder={title.trim() || "Titre affiché dans Google"}
          aria-describedby={`${uid}-titre-compteur ${uid}-titre-aide`}
          className="q-input md:text-[14px]"
        />
        <CharMeter id={`${uid}-titre-compteur`} length={effectiveTitle.length} idealMin={titleDef.idealMin} idealMax={titleDef.idealMax} max={titleDef.max} className="mt-0.5" />
        <p id={`${uid}-titre-aide`} className="q-field-hint m-0 leading-snug">
          {seoTitle.trim() ? "« | Qonforme » est ajouté automatiquement s'il tient." : "Vide : le titre de l'article est repris."}
        </p>
        <SuggestionList suggest={suggestTitle} className="mt-1" />
      </div>

      <div data-focus-target="seoDescription" className={FIELD_BLOCK}>
        <div className="flex min-h-8 items-center justify-between gap-2">
          <label htmlFor="blog-seo-description" className="q-label">
            Description
          </label>
          <SuggestButton suggest={suggestDescription} className="-mr-2" />
        </div>
        <AutoTextarea
          id="blog-seo-description"
          value={seoDescription}
          onChange={(e) => onSeoDescriptionChange(e.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
          maxLength={400}
          spellCheck
          lang="fr"
          placeholder={excerpt.trim() || "Une ou deux phrases qui donnent envie de cliquer"}
          aria-describedby={`${uid}-desc-compteur ${uid}-desc-aide`}
          className="q-input !min-h-[88px] !resize-none leading-snug md:text-[14px]"
        />
        <CharMeter id={`${uid}-desc-compteur`} length={effectiveDescription.length} idealMin={descDef.idealMin} idealMax={descDef.idealMax} max={descDef.max} className="mt-0.5" />
        <p id={`${uid}-desc-aide`} className="q-field-hint m-0 leading-snug">
          {seoDescription.trim() ? "Bénéfice concret, mot-clé, vouvoiement." : "Vide : le chapeau est repris."}
        </p>
        <SuggestionList suggest={suggestDescription} className="mt-1" />
      </div>

      <div className="flex flex-col gap-2">
        <span className="q-label">Aperçu</span>
        <SerpPreview title={effectiveTitle} description={effectiveDescription} slug={slug} date={date} />
      </div>
    </SideCard>
  )
}

/* ------------------------------------------------------------------ */
/* Adresse                                                             */
/* ------------------------------------------------------------------ */

export function AddressCard({
  slug,
  onSlugChange,
  fromTitle,
  onRecreate,
  suggest,
  error,
  changedWhileOnline,
  className,
}: {
  slug: string
  onSlugChange: (value: string) => void
  /** Adresse tirée du titre (slugify) ; vide si le titre l'est. */
  fromTitle: string
  onRecreate: () => void
  suggest: SuggestController
  /** Adresse refusée (déjà prise, invalide). */
  error: string | null
  /** Article en ligne dont l'adresse change : les liens déjà partagés ne mèneront plus à lui. */
  changedWhileOnline: boolean
  className?: string
}) {
  const uid = useId()
  const def = SUGGEST_FIELDS.slug
  const canRecreate = fromTitle !== "" && fromTitle !== slug.trim()

  return (
    <SideCard id="carte-adresse" icon={<Link2 />} title="Adresse" action={<SuggestButton suggest={suggest} />} className={className}>
      <div data-focus-target="slug" className={FIELD_BLOCK}>
        <label htmlFor="blog-slug" className="sr-only">
          Adresse de l&apos;article
        </label>
        <div
          className={cn(
            "q-fw flex h-[42px] items-center rounded-[10px] border bg-[var(--q-surface)] pl-3 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
            error ? "border-[var(--q-danger)] shadow-[0_0_0_4px_var(--q-danger-bg)]" : "border-[var(--q-field)]",
          )}
        >
          <span className="shrink-0 font-mono text-[13px] text-[var(--q-text-4)]" aria-hidden>
            /blog/
          </span>
          <input
            id="blog-slug"
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            maxLength={120}
            placeholder="adresse-de-l-article"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${uid}-compteur ${uid}-aide`}
            className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-base text-[var(--q-ink)] outline-none placeholder:text-[var(--q-placeholder)] md:text-[13px]"
          />
        </div>
        <CharMeter id={`${uid}-compteur`} length={slug.trim().length} idealMin={def.idealMin} idealMax={def.idealMax} max={def.max} className="mt-0.5" />
        {error ? (
          <p id={`${uid}-aide`} role="alert" className="q-field-error m-0 flex items-start gap-1.5 leading-snug">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : (
          <p id={`${uid}-aide`} className="q-field-hint m-0 leading-snug">
            3 à 6 mots du mot-clé, sans accents ni mots vides.
          </p>
        )}
        {changedWhileOnline && (
          <p className="m-0 flex items-start gap-1.5 text-[12px] leading-snug text-[var(--q-warn)]">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            L&apos;article est en ligne : les liens vers l&apos;ancienne adresse ne mèneront plus à lui.
          </p>
        )}
        <button
          type="button"
          onClick={onRecreate}
          disabled={!canRecreate}
          className="q-link mt-0.5 inline-flex min-h-8 items-center gap-1.5 self-start text-[12.5px] disabled:cursor-default disabled:text-[var(--q-text-4)] max-md:min-h-11"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Recréer depuis le titre
        </button>
        <SuggestionList suggest={suggest} className="mt-1" />
      </div>
    </SideCard>
  )
}

/* ------------------------------------------------------------------ */
/* Mots-clés secondaires                                               */
/* ------------------------------------------------------------------ */

export function SecondaryCard({
  keyword,
  seo,
  title,
  content,
  highlighted,
  onHighlightChange,
  className,
}: {
  keyword: string | null
  seo: SeoContextState
  title: string
  content: string
  highlighted: string[]
  onHighlightChange: (terms: string[]) => void
  className?: string
}) {
  return (
    <SideCard id="carte-secondaires" icon={<Tags />} title="Mots-clés secondaires" className={className}>
      <SecondaryKeywords
        keyword={keyword}
        keywords={seo.data?.keywords ?? []}
        pageQueries={seo.data?.pageQueries ?? []}
        title={title}
        content={content}
        highlighted={highlighted}
        onHighlightChange={onHighlightChange}
        loading={seo.loading && seo.data === null}
      />
    </SideCard>
  )
}

/* ------------------------------------------------------------------ */
/* Plan de l'article                                                   */
/* ------------------------------------------------------------------ */

export function OutlineCard({ headings, onGo, className }: { headings: { level: number; text: string }[]; onGo: (index: number) => void; className?: string }) {
  const count = headings.length
  return (
    <SideCard
      id="carte-plan"
      icon={<ListTree />}
      title="Plan de l'article"
      action={count > 0 ? <span className="q-count pr-1.5">{nf(count)} titre{count > 1 ? "s" : ""}</span> : undefined}
      className={className}
    >
      {count === 0 ? (
        <p className="m-0 text-[12.5px] leading-snug text-[var(--q-text-4)]">
          Ajoutez des intertitres (« Titre 2 », « Titre 3 ») : ils structurent l&apos;article pour les lecteurs et pour Google, et s&apos;affichent ici.
        </p>
      ) : (
        <ol className="relative -mx-2 m-0 flex list-none flex-col p-0">
          {headings.map((h, i) => {
            const depth = Math.max(0, Math.min(2, h.level - 2))
            return (
              <li key={`${i}-${h.text}`}>
                <button
                  type="button"
                  onClick={() => onGo(i)}
                  className="group flex w-full items-baseline gap-2 rounded-lg py-1.5 pr-2 text-left transition-colors duration-100 hover:bg-[var(--q-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--q-focus)] motion-reduce:transition-none max-md:min-h-11 max-md:items-center"
                  style={{ paddingLeft: 8 + depth * 14 }}
                  title={`Aller au titre « ${h.text} »`}
                >
                  <span
                    className={cn(
                      "w-6 shrink-0 font-mono text-[10.5px] font-semibold tabular-nums",
                      h.level === 1 ? "text-[var(--q-warn)]" : "text-[var(--q-text-4)] group-hover:text-[var(--q-accent-strong)]",
                    )}
                    aria-hidden
                  >
                    H{h.level}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]",
                      h.level <= 2 ? "text-[13px] font-medium text-[var(--q-ink)]" : "text-[12.5px] text-[var(--q-text-2)]",
                    )}
                  >
                    <span className="sr-only">Titre de niveau {h.level} : </span>
                    {h.text}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </SideCard>
  )
}
