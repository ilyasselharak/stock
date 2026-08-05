import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'STAFF'
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  const user = session?.user as SessionUser | undefined
  if (!session || !user?.id) {
    throw new ApiError(401, 'Unauthorized')
  }
  return {
    id: user.id,
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role,
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') {
    throw new ApiError(403, 'Admin access required')
  }
  return user
}

export async function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
