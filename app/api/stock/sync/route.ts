import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ApiError } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'
import { syncStockFromExternal } from '@/lib/stock-sync'

export const maxDuration = 60

// "Sync now" button (admins only).
export const POST = apiHandler(async function POST() {
  const session = await requireAdmin()
  return NextResponse.json(await syncStockFromExternal(session.id))
})

// Scheduled sync (e.g. Vercel Cron), authenticated with `Authorization: Bearer $CRON_SECRET`.
// Movements are attributed to the first active admin.
export const GET = apiHandler(async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    throw new ApiError(401, 'Unauthorized')
  }
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!admin) throw new ApiError(500, 'No active admin to attribute the sync to')
  return NextResponse.json(await syncStockFromExternal(admin.id))
})
