import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'all'
  const now = new Date()

  let dateFilter: { gte?: Date } = {}
  if (period === 'today') dateFilter = { gte: new Date(now.setHours(0, 0, 0, 0)) }
  else if (period === 'week') dateFilter = { gte: new Date(now.getTime() - 7 * 86400000) }
  else if (period === 'month') dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) }

  const where = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

  const [sales, creditSales, payments, products] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        user: { select: { name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    }),
    prisma.creditSale.findMany({
      where: Object.keys(dateFilter).length ? { createdAt: dateFilter } : {},
      include: { customer: true, payments: true },
    }),
    prisma.payment.findMany({
      where: Object.keys(dateFilter).length ? { date: dateFilter } : {},
      include: { user: { select: { name: true } }, creditSale: { include: { customer: true } } },
    }),
    prisma.product.findMany({ select: { id: true, name: true, sku: true, quantity: true, basePrice: true } }),
  ])

  const totalRevenue = sales.reduce((s, x) => s + x.total, 0)
  const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
  const totalPayments = payments.reduce((s, x) => s + x.amount, 0)
  const creditOutstanding = creditSales.reduce((s, x) => s + (x.totalPrice - x.amountPaid), 0)

  const productMap = new Map<string, { name: string; sold: number; revenue: number; profit: number }>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const cur = productMap.get(item.product.id) || {
        name: item.product.name,
        sold: 0,
        revenue: 0,
        profit: 0,
      }
      cur.sold += item.quantity
      cur.revenue += item.total
      cur.profit += item.profit
      productMap.set(item.product.id, cur)
    }
  }

  const topProducts = Array.from(productMap.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const stockValue = products.reduce((s, p) => s + p.quantity * p.basePrice, 0)
  const lowStock = products.filter((p) => p.quantity <= 5)

  return NextResponse.json({
    summary: { totalRevenue, totalProfit, totalSales: sales.length, totalPayments, creditOutstanding, stockValue },
    topProducts,
    lowStock,
    recentSales: sales.slice(0, 10),
    recentPayments: payments.slice(0, 10),
    creditSales: creditSales.slice(0, 10),
  })
})
