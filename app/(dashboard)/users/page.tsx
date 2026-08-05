import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import UsersManager from '@/components/users-manager'

export const metadata = { title: 'Users' }

export default async function UsersPage() {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  if (user?.role !== 'ADMIN') {
    redirect('/dashboard')
  }
  return <UsersManager currentUserId={user.id} />
}