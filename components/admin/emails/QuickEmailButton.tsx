"use client"

/**
 * Raccourci d'Admin › Utilisateurs : un bouton par compte, libellé selon l'étape
 * du parcours où il en est, qui ouvre directement la fenêtre d'envoi avec le
 * modèle conseillé (aperçu, essai, garde-fous du serveur : désinscription,
 * email de moins de 20 h).
 */
import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SendEmailDialog } from "@/components/admin/emails/AccountEmails"
import { shortcutLabel, templateForSteps } from "@/lib/email/account-templates"

export function QuickEmailButton({
  userId,
  accountLabel,
  done,
  lastTemplate,
  className,
}: {
  userId: string
  accountLabel: string
  done: boolean[]
  /** Modèle du dernier email envoyé à ce compte : le bouton dit alors « Relancer : … ». */
  lastTemplate?: string | null
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const template = templateForSteps(done)
  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Send aria-hidden />
        {shortcutLabel(template, lastTemplate)}
      </Button>
      {open && (
        <SendEmailDialog
          open={open}
          onClose={() => setOpen(false)}
          userId={userId}
          accountLabel={accountLabel}
          suggested={template}
        />
      )}
    </>
  )
}
