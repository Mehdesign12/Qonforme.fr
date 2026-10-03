import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BlogEditor } from '@/components/admin/BlogEditor'
import { PageHeader } from '@/components/app/kit'
import { LoadError } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Modifier l\'article' }

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const admin = createAdminClient()
  const { data: post, error } = await admin
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

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

  return <BlogEditor mode="edit" post={post} />
}
