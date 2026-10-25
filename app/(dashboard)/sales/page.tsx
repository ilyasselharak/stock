import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import SalesManager from '@/components/sales-manager'

export const metadata = { title: 'Sales' }

export default async function SalesPage() {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  return <SalesManager isAdmin={user?.role === 'ADMIN'} />
}
