"use client"

/**
 * « Ajouter un mot-clé » : fenêtre centrée (mot-clé, page cible facultative,
 * statut initial) → POST /api/admin/seo/keywords. Un doublon renvoie vers le
 * mot-clé déjà suivi.
 */
import { useId, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { KEYWORD_STATUS } from "@/lib/seo/types"

const INITIAL_STATUSES = ["candidate", "targeted", "covered"] as const

export function AddKeywordButton({ className }: { className?: string }) {
  const router = useRouter()
  const ids = useId()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [targetPath, setTargetPath] = useState("")
  const [status, setStatus] = useState<(typeof INITIAL_STATUSES)[number]>("candidate")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateId, setDuplicateId] = useState<string | null>(null)

  const reset = () => {
    setKeyword("")
    setTargetPath("")
    setStatus("candidate")
    setErrors({})
    setDuplicateId(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setDuplicateId(null)
    try {
      const res = await fetch("/api/admin/seo/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, target_path: targetPath, status }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string>; id?: string; keyword?: string }
      if (!res.ok) {
        setErrors(data.fieldErrors ?? { _: data.error ?? "Le mot-clé n'a pas pu être ajouté." })
        if (res.status === 409 && data.id) setDuplicateId(data.id)
        return
      }
      toast.success(`Mot-clé ajouté : ${data.keyword ?? keyword}`)
      setOpen(false)
      reset()
      router.refresh()
    } catch {
      setErrors({ _: "Erreur réseau. Réessayez." })
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={`${ids}-${name}-err`} role="alert" className="q-field-error">
        {errors[name]}
      </p>
    ) : null

  return (
    <>
      <button type="button" onClick={() => { reset(); setOpen(true) }} className={cn("q-btn q-btn-primary", className)}>
        <Plus aria-hidden />
        Ajouter un mot-clé
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o) }}>
        <DialogContent className="gap-4 sm:max-w-md">
          <DialogTitle className="q-display pr-8 text-[22px] font-semibold leading-tight">Ajouter un mot-clé</DialogTitle>
          <DialogDescription className="text-sm text-[var(--q-text-4)]">
            La requête telle que l&apos;internaute la tape dans Google. Positions et impressions arrivent avec Search Console.
          </DialogDescription>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-keyword`} className="text-sm font-semibold text-[var(--q-ink)]">
                Mot-clé
              </label>
              <input
                id={`${ids}-keyword`}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                required
                autoComplete="off"
                maxLength={200}
                placeholder="mentions obligatoires devis"
                aria-invalid={errors.keyword ? true : undefined}
                aria-describedby={errors.keyword ? `${ids}-keyword-err` : undefined}
                className="q-input font-mono text-base max-md:h-12 md:text-sm"
              />
              {fieldError("keyword")}
              {duplicateId && (
                <Link href={`/admin/seo/mots-cles?mot-cle=${duplicateId}`} onClick={() => setOpen(false)} className="q-link text-[13px]">
                  Ouvrir ce mot-clé
                </Link>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-path`} className="text-sm font-semibold text-[var(--q-ink)]">
                Page cible <span className="font-normal text-[var(--q-text-4)]">(facultatif)</span>
              </label>
              <input
                id={`${ids}-path`}
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                autoComplete="off"
                inputMode="url"
                placeholder="/guide/mentions-obligatoires-devis"
                aria-invalid={errors.target_path ? true : undefined}
                aria-describedby={errors.target_path ? `${ids}-target_path-err` : `${ids}-path-hint`}
                className="q-input font-mono text-base max-md:h-12 md:text-sm"
              />
              {errors.target_path ? fieldError("target_path") : (
                <p id={`${ids}-path-hint`} className="q-field-hint">Chemin d&apos;une page de qonforme.fr, par exemple /modele.</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-status`} className="text-sm font-semibold text-[var(--q-ink)]">
                Statut
              </label>
              <select
                id={`${ids}-status`}
                value={status}
                onChange={(e) => setStatus(e.target.value as (typeof INITIAL_STATUSES)[number])}
                aria-invalid={errors.status ? true : undefined}
                aria-describedby={errors.status ? `${ids}-status-err` : undefined}
                className="q-input text-base max-md:h-12 md:text-sm"
              >
                {INITIAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {KEYWORD_STATUS[s].label}
                  </option>
                ))}
              </select>
              {fieldError("status")}
            </div>

            {fieldError("_")}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="q-btn q-btn-ghost max-md:h-12">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="q-btn q-btn-primary max-md:h-12">
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                {saving ? "Ajout…" : "Ajouter"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
