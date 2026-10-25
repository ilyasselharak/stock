import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import CustomersManager from '@/components/customers-manager'

export const metadata = { title: 'Credit Customers' }

export default async function CustomersPage() {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  return <CustomersManager isAdmin={user?.role === 'ADMIN'} />
}
