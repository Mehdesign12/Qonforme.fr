import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BlogEditor } from '@/components/admin/BlogEditor'
import { PageHeader } from '@/components/app/kit'
import { LoadError } from '@/components/admin/ui'
import { ID } from '@/lib/seo/articles/input'
import { readPublishTime } from '@/lib/seo/articles/publish-time'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Modifier l\'article' }

/**
 * Modifier un article. L'heure des Préférences sert de proposition quand on
 * programme la publication (sans elle, un brouillon proposerait toujours
 * 08:00) ; l'instant du rendu donne le même état initial au serveur et au
 * navigateur.
 */
export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Adresse qui n'est pas un identifiant : introuvable (la base répondrait par une erreur de type)
  if (!ID.safeParse(id).success) notFound()

  const admin = createAdminClient()
  const [{ data: post, error }, publishTime] = await Promise.all([
    admin.from('blog_posts').select('*').eq('id', id).maybeSingle(),
    readPublishTime(),
  ])

  // Une panne de lecture n'est pas un article introuvable
  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Modifier l'article" backHref="/admin/blog" backLabel="Blog" />
        <LoadError what="cet article" />
      </div>
    )
  }
  if (!post) notFound()

  return <BlogEditor mode="edit" post={post} publishTime={publishTime} renderedAt={new Date().toISOString()} />
}
