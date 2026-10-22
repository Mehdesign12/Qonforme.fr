"use client"

/**
 * Fiche d'un document scanné : ses pages, ses champs modifiables, le PDF et la
 * suppression. Partagée par /documents/[id] et /demo/documents/[id].
 */
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, FileText, Loader2, ScanLine, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { EmptyState, PageHeader, Panel } from "@/components/app/kit"
import { SetCrumb } from "@/components/layout/crumb"
import { ClassifyForm, fieldsFromForm, formFromDocument, type ScanFormValues } from "@/components/scan/ClassifyForm"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { SCAN_KIND_LABELS, documentName, formatBytes, type ScanDocumentDetail } from "@/lib/scan/documents"
import type { ScanApi } from "@/lib/scan/api"

export function DocumentDetailView({
  mode, api, id, clients, chantiers,
}: {
  mode: "app" | "demo"
  api: ScanApi
  id: string
  clients: { id: string; name: string }[]
  chantiers: { id: string; name: string }[]
}) {
  const router = useRouter()
  const back = mode === "demo" ? "/demo/documents" : "/documents"
  const [doc, setDoc] = useState<ScanDocumentDetail | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [message, setMessage] = useState("")
  const [form, setForm] = useState<ScanFormValues | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initial, setInitial] = useState("")

  const load = useCallback(async () => {
    setState("loading")
    try {
      const d = await api.get(id)
      setDoc(d)
      const f = formFromDocument(d)
      setForm(f)
      setInitial(JSON.stringify(f))
      setState("ready")
    } catch (e) {
      const text = e instanceof Error ? e.message : "Erreur réseau"
      setMessage(text)
      setState(/introuvable/i.test(text) ? "missing" : "error")
    }
  }, [api, id])

  useEffect(() => { void load() }, [load])

  if (state === "loading") return <div className="q-card h-72 animate-pulse" aria-busy="true" />
  if (state !== "ready" || !doc || !form) {
    return (
      <Panel>
        <EmptyState
          icon={<ScanLine />}
          title={state === "missing" ? "Document introuvable" : "Ce document n'a pas pu être chargé."}
          text={state === "missing" ? "Il a peut-être été supprimé." : message}
          action={state === "missing"
            ? <Link href={back} className="q-btn q-btn-secondary">Retour aux documents</Link>
            : <button type="button" onClick={() => void load()} className="q-btn q-btn-secondary">Réessayer</button>}
        />
      </Panel>
    )
  }

  const dirty = JSON.stringify(form) !== initial
  const pdf = api.pdfHref(doc.id)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.update(doc.id, fieldsFromForm(form, "classified"))
      setDoc({ ...doc, ...updated, pages: doc.pages, thumb_url: doc.thumb_url })
      setInitial(JSON.stringify(form))
      toast.success("Document enregistré.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'enregistrement a échoué. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await api.remove(doc.id)
      toast.success("Document supprimé.")
      router.push(back)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La suppression a échoué. Réessayez.")
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SetCrumb label={documentName(doc)} />
      <PageHeader
        title={documentName(doc)}
        subtitle={`${SCAN_KIND_LABELS[doc.kind]}${doc.doc_number ? ` · ${doc.doc_number}` : ""} · ${doc.page_count} page${doc.page_count > 1 ? "s" : ""} · ${formatBytes(doc.total_bytes)}`}
        backHref={back}
        backLabel="Documents"
        actions={
          pdf ? (
            <a href={pdf} className="q-btn q-btn-secondary h-11"><Download aria-hidden />Télécharger le PDF</a>
          ) : (
            <button type="button" className="q-btn q-btn-secondary h-11" onClick={() => toast("Créez un compte pour télécharger vos documents en PDF", { action: { label: "S'inscrire", onClick: () => { window.location.href = "/signup" } } })}>
              <Download aria-hidden />Télécharger le PDF
            </button>
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3" aria-label="Pages du document">
          {doc.pages.length === 0 ? (
            <Panel><EmptyState icon={<FileText />} title="Aucune page enregistrée." /></Panel>
          ) : doc.pages.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-2xl border border-[var(--q-line)] bg-[var(--q-surface)]">
              {p.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.url} alt={`Page ${p.position} sur ${doc.page_count}`} className="block w-full" width={p.width ?? undefined} height={p.height ?? undefined} loading={p.position > 1 ? "lazy" : undefined} />
                : <div className="grid h-48 place-items-center text-sm text-[var(--q-text-4)]">Cette page n&apos;a pas pu être affichée.</div>}
              {doc.page_count > 1 && <figcaption className="border-t border-[var(--q-line-soft)] px-3 py-2 text-xs text-[var(--q-text-4)]">Page {p.position} sur {doc.page_count}</figcaption>}
            </figure>
          ))}
        </div>

        <Panel title="Informations" bodyClassName="flex flex-col gap-5 px-5 pb-5">
          <ClassifyForm values={form} onChange={setForm} clients={clients} chantiers={chantiers} disabled={saving} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={!dirty || saving} className="q-btn q-btn-primary h-11">
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              Enregistrer
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} className="q-btn q-btn-secondary ml-auto h-11"><Trash2 aria-hidden />Supprimer</button>
          </div>
        </Panel>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(o) => { if (!deleting) setConfirmDelete(o) }}>
        <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Supprimer ce document&nbsp;?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--q-text-3)]">Ses pages sont effacées définitivement. Cela libère de l&apos;espace de scan.</DialogDescription>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="q-btn q-btn-secondary h-11" onClick={() => setConfirmDelete(false)} disabled={deleting}>Annuler</button>
            <button type="button" className="q-btn q-btn-danger h-11" onClick={() => void remove()} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}Supprimer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
