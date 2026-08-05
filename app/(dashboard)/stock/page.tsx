import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import StockManager from '@/components/stock-manager'

export const metadata = { title: 'Stock' }

export default async function StockPage() {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  return <StockManager isAdmin={user?.role === 'ADMIN'} />
}