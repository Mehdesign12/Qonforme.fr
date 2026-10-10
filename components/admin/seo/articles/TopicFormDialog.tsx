"use client"

/**
 * « Ajouter un sujet » et « Modifier » (écran Sujets) : sujet, mot-clé cible
 * (mots-clés suivis proposés), type, angle, notes pour la rédaction.
 */
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { ARTICLE_TYPE_LABELS, type ArticleType } from "@/lib/seo/types"
import { api } from "@/components/admin/seo/articles/api"
import { Field, Select } from "@/components/admin/seo/articles/fields"

const TYPES: ArticleType[] = ["howto", "guide", "news", "faq"]

export interface TopicFormValue {
  id?: string
  title: string
  keyword: string | null
  articleType: ArticleType
  angle: string | null
  notes: string | null
}

export function TopicFormDialog({
  open,
  initial,
  onClose,
  keywords,
  angles,
}: {
  open: boolean
  /** Sujet à modifier ; absent : nouveau sujet. */
  initial: TopicFormValue | null
  onClose: () => void
  keywords: { keyword: string; label: string }[]
  angles: { key: string; label: string }[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [keyword, setKeyword] = useState("")
  const [type, setType] = useState<ArticleType>("guide")
  const [angle, setAngle] = useState("varied")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title ?? "")
    setKeyword(initial?.keyword ?? "")
    setType(initial?.articleType ?? "guide")
    setAngle(initial?.angle ?? "varied")
    setNotes(initial?.notes ?? "")
    setError(null)
    setFieldErrors({})
  }, [open, initial])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})
    const body = { title: title.trim(), keyword: keyword.trim() || null, articleType: type, angle: angle === "varied" ? null : angle, notes: notes.trim() || null }
    const res = initial?.id ? await api(`/api/admin/seo/topics/${initial.id}`, "PATCH", { action: "update", ...body }) : await api("/api/admin/seo/topics", "POST", body)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      setFieldErrors(res.fieldErrors ?? {})
      return
    }
    toast.success(initial?.id ? "Sujet modifié" : "Sujet ajouté")
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 px-6 pb-3 pr-14 pt-5">
          <DialogTitle className="text-base font-semibold tracking-[-0.01em] text-[var(--q-ink)]">{initial?.id ? "Modifier le sujet" : "Ajouter un sujet"}</DialogTitle>
          <DialogDescription className="text-[13px] text-[var(--q-text-4)]">Le sujet attend sa planification ou sa rédaction ; rien ne paraît sans décision.</DialogDescription>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-6 pt-2">
            <Field label="Sujet" htmlFor="topic-title" error={fieldErrors.title}>
              <input
                id="topic-title"
                className="q-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                placeholder="Par exemple : Relancer une facture impayée sans perdre le client"
                aria-invalid={Boolean(fieldErrors.title)}
                required
              />
            </Field>
            <Field label="Mot-clé cible" htmlFor="topic-keyword" error={fieldErrors.keyword} hint="Facultatif. Les mots-clés suivis sont proposés.">
              <input id="topic-keyword" className="q-input font-mono" list="topic-keywords" value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={120} />
              <datalist id="topic-keywords">
                {keywords.map((k) => (
                  <option key={k.keyword} value={k.keyword}>
                    {k.label}
                  </option>
                ))}
              </datalist>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span id="topic-type" className="q-label">
                Type
              </span>
              <div role="group" aria-labelledby="topic-type" className="q-seg flex w-full">
                {TYPES.map((t) => (
                  <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className="min-h-11 flex-1 md:min-h-8">
                    {ARTICLE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Angle" htmlFor="topic-angle">
              <Select id="topic-angle" value={angle} onChange={(e) => setAngle(e.target.value)}>
                <option value="varied">Varié (recommandé)</option>
                {angles.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes pour la rédaction" htmlFor="topic-notes" error={fieldErrors.notes} hint="Facultatif : points à couvrir, public visé, texte officiel à citer.">
              <textarea id="topic-notes" className="q-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </Field>
            {error && (
              <p role="alert" className="q-field-error !text-[13px]">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--q-line-soft)] px-6 py-3.5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="q-btn q-btn-ghost max-sm:q-btn-lg">
              Annuler
            </button>
            <button type="submit" disabled={busy} className="q-btn q-btn-primary max-sm:q-btn-lg">
              {busy && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
              {initial?.id ? "Enregistrer" : "Ajouter le sujet"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
