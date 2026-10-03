import { BlogEditor } from '@/components/admin/BlogEditor'

export const metadata = { title: 'Admin — Nouvel article' }

export default function AdminBlogNewPage() {
  return <BlogEditor mode="create" />
}
