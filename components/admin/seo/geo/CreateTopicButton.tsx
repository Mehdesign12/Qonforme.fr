"use client"

/**
 * « Créer un sujet » (détail d'une question) : un sujet d'article à planifier dans
 * Articles › Sujets, titré par la question. Un sujet déjà créé n'est pas recréé.
 */
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Loader2, Plus } from "lucide-react"

export function CreateTopicButton({ questionId }: { questionId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState(false)

  const create = async () => {
    setPending(true)
    try {
      const res = await fetch(`/api/admin/seo/geo/questions/${questionId}/topic`, { method: "POST" })
      const body = (await res.json().catch(() => ({}))) as { error?: string; existed?: boolean }
      if (!res.ok) {
        toast.error(body.error ?? "Le sujet n'a pas été créé. Réessayez dans un instant.")
        return
      }
      setCreated(true)
      toast.success(body.existed ? "Un sujet existe déjà pour cette question." : "Sujet créé dans Articles › Sujets.")
      router.refresh()
    } catch {
      toast.error("Erreur réseau : le sujet n'a pas été créé.")
    } finally {
      setPending(false)
    }
  }

  if (created) {
    return (
      <Link href="/admin/seo/articles/sujets" className="q-btn q-btn-secondary h-12 w-full md:h-10 md:w-auto">
        Voir dans Articles › Sujets
        <ChevronRight aria-hidden />
      </Link>
    )
  }
  return (
    <button type="button" onClick={create} disabled={pending} aria-busy={pending} className="q-btn q-btn-secondary h-12 w-full md:h-10 md:w-auto">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
      Créer un sujet
    </button>
  )
}
