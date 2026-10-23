import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/signature/server'
import { adminThread, type ServiceResult } from '@/lib/support-chat/server'
import { PageHeader } from '@/components/app/kit'
import { LoadError } from '@/components/admin/ui'
import { ChatThread, type AdminConversation, type AdminMessage } from '@/components/admin/ChatThread'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Conversation' }

export default async function AdminChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const db = createAdminClient()
  const result: ServiceResult = await adminThread(db, id)
  if (result.status === 404) notFound()
  if (result.status !== 200) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Conversation" backHref="/admin/support/chat" backLabel="Conversations" />
        <LoadError what="la conversation" />
      </div>
    )
  }
  const { data: canned } = await db.from('support_canned_replies').select('id, title, body').order('position')
  // Ouvrir la conversation la marque comme lue.
  if ((result.body.conversation as AdminConversation).admin_unread) await db.from('support_conversations').update({ admin_unread: false }).eq('id', id)
  return (
    <ChatThread
      conversation={result.body.conversation as AdminConversation}
      messages={result.body.messages as AdminMessage[]}
      canned={(canned ?? []) as { id: string; title: string; body: string }[]}
    />
  )
}
