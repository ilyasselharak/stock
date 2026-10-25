import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import PaymentsManager from '@/components/payments-manager'

export const metadata = { title: 'Credit Sales & Payments' }

export default async function PaymentsPage() {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  return <PaymentsManager isAdmin={user?.role === 'ADMIN'} />
}
