import Link from 'next/link'
import { CircleCheck, Pencil, ShieldAlert } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { auditArticle, type AuditFinding } from '@/lib/blog-audit'
import { EmptyState, PageHeader, StatusPill } from '@/components/app/kit'
import { LoadError, plural } from '@/components/admin/ui'

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
  const flaggedPublished = flagged.filter((x) => x.post.is_published).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Vérification du blog"
        subtitle={
          error
            ? 'Lecture impossible'
            : flagged.length > 0
              ? `${plural(flagged.length, 'article')} à relire sur ${plural(posts.length, 'article')}, dont ${plural(flaggedPublished, 'publié')}`
              : `${plural(posts.length, 'article vérifié', 'articles vérifiés')}`
        }
      />

      <p className="max-w-[720px] text-sm leading-relaxed text-[var(--q-text-3)]">
        Repère les anciens seuils, l&apos;ancien calcul des pénalités de retard, les références d&apos;articles fausses et les affirmations
        interdites (certification, avis). Rien n&apos;est modifié automatiquement : ouvrez l&apos;article, corrigez le passage, enregistrez.
      </p>

      {error ? (
        <LoadError what="les articles" />
      ) : flagged.length === 0 ? (
        <div className="q-card">
          <EmptyState
            icon={<CircleCheck className="size-5" aria-hidden />}
            title="Aucun passage à relire"
            text={`Les ${plural(posts.length, 'article')} du blog ne contiennent aucune des valeurs ou affirmations repérées.`}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Articles à relire">
          {flagged.map(({ post, findings }) => (
            <li key={post.id} className="q-card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--q-line-soft)] px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-semibold text-[var(--q-ink)]">{post.title}</p>
                  <p className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={post.is_published ? 'ok' : 'neutral'}>{post.is_published ? 'Publié' : 'Brouillon'}</StatusPill>
                    <span className="break-all font-mono text-xs text-[var(--q-text-4)]">/blog/{post.slug}</span>
                  </p>
                </div>
                <Link href={`/admin/blog/${post.id}`} className="q-btn q-btn-secondary q-btn-sm shrink-0">
                  <Pencil aria-hidden />
                  Corriger
                </Link>
              </div>
              <ul className="flex flex-col gap-2 p-3 sm:p-4">
                {groupByRule(findings).map(({ rule, excerpts }) => (
                  <li key={rule.id} className="rounded-xl border border-[var(--q-warn-line)] bg-[var(--q-warn-bg)] p-3 text-[13px] leading-relaxed">
                    <p className="flex items-center gap-1.5 font-semibold text-[var(--q-warn)]">
                      <ShieldAlert className="size-4 shrink-0" aria-hidden /> {rule.label}
                    </p>
                    {excerpts.map((e, i) => (
                      <p key={i} className="mt-1 break-words text-[var(--q-text-2)]">« {e} »</p>
                    ))}
                    <p className="mt-1.5 text-[var(--q-ink)]"><strong>À la place :</strong> {rule.correction}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
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
