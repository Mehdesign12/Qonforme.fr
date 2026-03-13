import { BlogEditor } from '@/components/admin/BlogEditor'

export const metadata = { title: 'Admin — Nouvel article' }

export default function AdminBlogNewPage() {
  return (
    <div className="max-w-[800px] mx-auto">
      <BlogEditor mode="create" />
    </div>
  )
}
