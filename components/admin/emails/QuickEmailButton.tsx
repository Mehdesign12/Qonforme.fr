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
import { SHORTCUT_LABELS, templateForSteps } from "@/lib/email/account-templates"

export function QuickEmailButton({
  userId,
  accountLabel,
  done,
  className,
}: {
  userId: string
  accountLabel: string
  done: boolean[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const template = templateForSteps(done)
  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Send aria-hidden />
        {SHORTCUT_LABELS[template]}
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
