import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Eye, EyeOff, FileText, Pencil, Plus } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill } from '@/components/app/kit'
import { LoadError, fmtDate, plural } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Blog' }

async function getPosts() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('blog_posts')
    .select('id, slug, title, excerpt, is_published, published_at, created_at, updated_at')
    .order('created_at', { ascending: false })
  return { posts: data ?? [], error: !!error }
}

function PublishPill({ published }: { published: boolean }) {
  return published ? (
    <StatusPill tone="ok" icon={<Eye strokeWidth={2.25} aria-hidden />}>Publié</StatusPill>
  ) : (
    <StatusPill tone="neutral" icon={<EyeOff strokeWidth={2.25} aria-hidden />}>Brouillon</StatusPill>
  )
}

function dateLine(post: { is_published: boolean; published_at: string | null; updated_at: string }): string {
  return post.is_published && post.published_at
    ? `Publié le ${fmtDate(post.published_at)}`
    : `Modifié le ${fmtDate(post.updated_at)}`
}

export default async function AdminBlogPage() {
  const { posts, error } = await getPosts()

  const published = posts.filter(p => p.is_published).length
  const drafts    = posts.filter(p => !p.is_published).length

  const newButton = (
    <Link href="/admin/blog/new" className="q-btn q-btn-primary">
      <Plus strokeWidth={2.25} aria-hidden />
      Nouvel article
    </Link>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Blog"
        subtitle={error ? 'Lecture impossible' : `${plural(published, 'article publié', 'articles publiés')} · ${plural(drafts, 'brouillon')}`}
        actions={newButton}
      />

      {error ? (
        <LoadError what="les articles" />
      ) : posts.length === 0 ? (
        <div className="q-card">
          <EmptyState
            icon={<FileText className="size-5" aria-hidden />}
            title="Aucun article"
            text="Rédigez un premier article, ou générez-en un depuis la page Génération IA."
            action={newButton}
          />
        </div>
      ) : (
        <>
          {/* Tableau (ordinateur) */}
          <section aria-label="Articles" className="q-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="q-table min-w-[720px] [&_th]:border-t-0">
                <thead>
                  <tr className="bg-[var(--q-surface-2)]">
                    <th scope="col">Article</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Date</th>
                    <th scope="col"><span className="sr-only">Modifier</span></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td className="max-w-[560px] !py-3">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-semibold">{post.title}</span>
                          {post.excerpt && <span className="line-clamp-1 text-[13px] text-[var(--q-text-3)]">{post.excerpt}</span>}
                          <span className="truncate font-mono text-xs text-[var(--q-text-4)]">/blog/{post.slug}</span>
                        </span>
                      </td>
                      <td className="!py-3"><PublishPill published={post.is_published} /></td>
                      <td className="!py-3 whitespace-nowrap text-[13px] text-[var(--q-text-3)]">{dateLine(post)}</td>
                      <td className="w-px !py-3 text-right">
                        <Link href={`/admin/blog/${post.id}`} className="q-btn q-btn-ghost q-btn-sm">
                          <Pencil aria-hidden />
                          Modifier
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Liste (mobile) */}
          <section aria-label="Articles" className="q-card q-list overflow-hidden !rounded-[18px] md:hidden">
            {posts.map((post) => (
              <Link key={post.id} href={`/admin/blog/${post.id}`} className="q-list-row !items-start !gap-3 !px-3.5 !py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-[15px] font-semibold">{post.title}</span>
                  <span className="truncate text-[13px] text-[var(--q-text-4)]">{dateLine(post)}</span>
                </span>
                <PublishPill published={post.is_published} />
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
