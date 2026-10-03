import Link from 'next/link'
import { ShieldAlert, CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { auditArticle, type AuditFinding } from '@/lib/blog-audit'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin — Vérification du blog' }

type Post = { id: string; slug: string; title: string; excerpt: string | null; content: string | null; is_published: boolean }

async function getPosts(): Promise<{ posts: Post[]; error: boolean }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('blog_posts')
    .select('id, slug, title, excerpt, content, is_published')
    .order('created_at', { ascending: false })
  return { posts: (data ?? []) as Post[], error: Boolean(error) }
}

/** Articles qui citent une valeur obsolète ou une affirmation interdite, à relire avant tout. */
export default async function BlogVerificationPage() {
  const { posts, error } = await getPosts()
  const flagged = posts
    .map((p) => ({ post: p, findings: auditArticle([p.title, p.excerpt, p.content].filter(Boolean).join('\n\n')) }))
    .filter((x) => x.findings.length > 0)
    // Les articles publiés d'abord : ce sont eux que lisent les visiteurs
    .sort((a, b) => Number(b.post.is_published) - Number(a.post.is_published) || b.findings.length - a.findings.length)

  return (
    <div className="space-y-5 max-w-[960px] mx-auto">
      <div>
        <Link href="/admin/blog" className="text-[12px] text-slate-400 hover:text-[#2563EB]">← Blog</Link>
        <h1 className="text-[22px] font-extrabold text-[#0F172A] dark:text-[#E2E8F0] leading-tight mt-1">Vérification des articles</h1>
        <p className="text-[13px] text-slate-500 mt-1 max-w-[680px]">
          Repère les anciens seuils, l&apos;ancien calcul des pénalités de retard, les références d&apos;articles fausses et les affirmations
          interdites (certification, avis). Rien n&apos;est modifié automatiquement : ouvrez l&apos;article, corrigez le passage, enregistrez.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          Impossible de lire les articles. Réessayez dans un instant.
        </div>
      ) : flagged.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] px-4 py-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
          <p className="text-sm font-medium text-foreground">Aucun passage à relire sur {posts.length} article(s).</p>
        </div>
      ) : (
        <>
          <p className="text-[13px] font-semibold text-[#0F172A] dark:text-[#E2E8F0]">
            {flagged.length} article(s) à relire sur {posts.length}, dont {flagged.filter((x) => x.post.is_published).length} publié(s).
          </p>
          <ul className="space-y-3">
            {flagged.map(({ post, findings }) => (
              <li key={post.id} className="rounded-2xl border border-slate-100 dark:border-[#1E3A5F] bg-white/95 dark:bg-[#0F1E35] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{post.title}</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">/{post.slug} · {post.is_published ? 'publié' : 'brouillon'}</p>
                  </div>
                  <Link href={`/admin/blog/${post.id}`} className="shrink-0 text-[12px] font-medium text-[#2563EB] hover:underline">
                    Corriger →
                  </Link>
                </div>
                <ul className="mt-3 space-y-2">
                  {groupByRule(findings).map(({ rule, excerpts }) => (
                    <li key={rule.id} className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-[13px]">
                      <p className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                        <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden /> {rule.label}
                      </p>
                      {excerpts.map((e, i) => (
                        <p key={i} className="mt-1 text-slate-600 dark:text-slate-300 break-words">« {e} »</p>
                      ))}
                      <p className="mt-1.5 text-slate-700 dark:text-slate-200"><strong>À la place :</strong> {rule.correction}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function groupByRule(findings: AuditFinding[]) {
  const map = new Map<string, { rule: AuditFinding['rule']; excerpts: string[] }>()
  for (const f of findings) {
    const entry = map.get(f.rule.id) ?? { rule: f.rule, excerpts: [] }
    entry.excerpts.push(f.excerpt)
    map.set(f.rule.id, entry)
  }
  return Array.from(map.values())
}
