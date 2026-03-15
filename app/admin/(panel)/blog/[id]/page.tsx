import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BlogEditor } from '@/components/admin/BlogEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Éditer article' }

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const admin = createAdminClient()
  const { data: post } = await admin
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (!post) notFound()

  return (
    <div className="max-w-[800px] mx-auto">
      <BlogEditor mode="edit" post={post} />
    </div>
  )
}
