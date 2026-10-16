import { BlogEditor } from '@/components/admin/BlogEditor'
import { readPublishTime } from '@/lib/seo/articles/publish-time'
import { programmedDay } from '@/components/admin/blog/shell/model'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Nouvel article' }

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Nouvel article. Ouvert depuis le calendrier, il est programmé le jour
 * choisi à l'heure des Préférences ; aujourd'hui, si cette heure est passée,
 * l'éditeur propose la prochaine heure possible et la fait confirmer.
 */
export default async function AdminBlogNewPage({ searchParams }: { searchParams: SearchParams }) {
  const now = new Date()
  // Jour du calendrier : aujourd'hui ou plus tard (heure de Paris), sinon brouillon
  const initialSchedule = programmedDay(searchParams.programmer, now)
  const publishTime = await readPublishTime()
  return <BlogEditor mode="create" initialSchedule={initialSchedule} publishTime={publishTime} renderedAt={now.toISOString()} />
}
