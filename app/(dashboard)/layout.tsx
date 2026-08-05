import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/permissions'
import { Sidebar } from '@/components/sidebar'
import { MobileNav } from '@/components/mobile-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Sidebar role={user.role} />
      </aside>

      {/* Mobile topbar */}
      <MobileNav role={user.role} name={user.name} />

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-24 lg:pb-10">
          {children}
        </div>
      </main>
    </div>
  )
}