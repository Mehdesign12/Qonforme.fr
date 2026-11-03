'use client'

/**
 * « Nouveau client » depuis un devis, une facture ou un bon de commande, sans
 * quitter le document : le formulaire client s'ouvre par-dessus (fenêtre sur
 * ordinateur, feuille pleine hauteur sur téléphone), enregistre le client
 * (POST /api/clients) et le rend au document, qui le sélectionne aussitôt.
 * Avant, le lien menait à /clients/new et tout ce qui était saisi dans le
 * document était perdu.
 */
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { SheetGrip } from "@/components/ui/sheet-grip"
import { ClientFormPage, type ClientPayload } from "@/components/clients/ClientForm"
import type { DocClient } from "./model"

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return desktop
}

export function NewClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: DocClient) => void
}) {
  const desktop = useDesktop()

  const create = async (payload: ClientPayload) => {
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.client?.id) {
        toast.error(json.error || "Erreur lors de la création du client")
        return
      }
      toast.success("Client créé et ajouté au document")
      onCreated(json.client as DocClient)
      onOpenChange(false)
    } catch {
      toast.error("Erreur réseau")
    }
  }

  const form = open ? (
    <ClientFormPage
      mode="create"
      title="Nouveau client"
      backHref="/clients"
      backLabel="Clients"
      cancelHref="/clients"
      submitLabel="Créer le client"
      onSubmit={create}
      embedded={{ onCancel: () => onOpenChange(false) }}
    />
  ) : null

  const lead = "Il est ajouté à votre liste de clients et sélectionné dans ce document. Rien de ce que vous avez saisi n'est perdu."

  return desktop ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto p-6 sm:max-w-[640px]">
        <div className="flex flex-col gap-1.5 pr-8">
          <DialogTitle className="q-display text-[22px] font-semibold leading-tight">Nouveau client</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed !text-[var(--q-text-3)]">{lead}</DialogDescription>
        </div>
        {form}
      </DialogContent>
    </Dialog>
  ) : (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="h-[94dvh] gap-3 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
        <SheetGrip />
        <div className="flex flex-col gap-1 pt-2">
          <SheetTitle className="q-display text-[22px] font-semibold leading-tight">Nouveau client</SheetTitle>
          <SheetDescription className="text-[15px] leading-relaxed !text-[var(--q-text-3)]">{lead}</SheetDescription>
        </div>
        {form}
      </SheetContent>
    </Sheet>
  )
}
