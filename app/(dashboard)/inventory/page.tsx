import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import InventoryManager from '@/components/inventory-manager'

export const metadata = { title: 'Inventory' }

export default async function InventoryPage() {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  return <InventoryManager isAdmin={user?.role === 'ADMIN'} />
}
