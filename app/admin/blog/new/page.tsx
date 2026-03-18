import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { BlogPostForm } from '../BlogPostForm'

export default async function NewBlogPostPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return <BlogPostForm />
}
