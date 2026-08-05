import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import ProductsManager from '@/components/products-manager'

export const metadata = { title: 'Products' }

export default async function ProductsPage() {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div>
      <ProductsManager isAdmin={isAdmin} />
    </div>
  )
}
