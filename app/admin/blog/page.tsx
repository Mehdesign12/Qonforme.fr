import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Plus, Eye, EyeOff } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Blog' }

async function getPosts() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('blog_posts')
    .select('id, slug, title, excerpt, is_published, published_at, created_at, updated_at')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminBlogPage() {
  const posts = await getPosts()

  const published = posts.filter(p => p.is_published).length
  const drafts    = posts.filter(p => !p.is_published).length

  return (
    <div className="space-y-5 max-w-[960px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight">Blog</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{published} publié(s) · {drafts} brouillon(s)</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel article
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] overflow-hidden">
        {posts.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-foreground mb-1">Aucun article</p>
            <p className="text-[13px] text-slate-400 mb-4">Créez votre premier article de blog.</p>
            <Link
              href="/admin/blog/new"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Créer un article
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1E3A5F] bg-slate-50/80 dark:bg-[#162032]/60">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Titre</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1E3A5F]">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{post.title}</p>
                    {post.excerpt && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{post.excerpt}</p>}
                    <p className="text-[11px] font-mono text-slate-300 dark:text-slate-600 mt-0.5">/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {post.is_published ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Eye className="w-3 h-3" /> Publié
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <EyeOff className="w-3 h-3" /> Brouillon
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-400">
                    {post.is_published && post.published_at
                      ? `Publié le ${new Date(post.published_at).toLocaleDateString('fr-FR')}`
                      : `Modifié le ${new Date(post.updated_at).toLocaleDateString('fr-FR')}`
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/blog/${post.id}`} className="text-[12px] font-medium text-[#2563EB] hover:underline">
                      Éditer →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
