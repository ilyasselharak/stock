import { NextResponse, type NextRequest } from 'next/server'

// /api/stock/sync checks its own auth (admin session or CRON_SECRET) so the scheduler can reach it
const publicPaths = ['/login', '/api/auth', '/api/stock/sync']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('next-auth.session-token')
    || request.cookies.get('__Secure-next-auth.session-token')

  const isPublic = publicPaths.some((p) => pathname.startsWith(p))
  const isApi = pathname.startsWith('/api')

  // Public routes (login + auth endpoints) pass through
  if (isPublic) {
    return NextResponse.next()
  }

  // Not logged in -> redirect to login
  if (!sessionToken) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
