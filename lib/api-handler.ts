import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

export function apiHandler<Args extends unknown[], Res extends NextResponse>(
  fn: (...args: Args) => Promise<Res>
) {
  return async (...args: Args): Promise<Res | NextResponse> => {
    try {
      return await fn(...args)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status }) as Res
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ error: 'Database error' }, { status: 400 }) as Res
      }
      console.error('[api]', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) as Res
    }
  }
}
