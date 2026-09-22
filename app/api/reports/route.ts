import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'
import { getReportData } from '@/lib/reports-data'

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'all'

  const { summary, topProducts, lowStock, recentSales, recentPayments, creditSales } = await getReportData(period)

  return NextResponse.json({ summary, topProducts, lowStock, recentSales, recentPayments, creditSales })
})
