import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'

export const GET = apiHandler(async function GET() {
  await requireAuth()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    productCount,
    products,
    todaySales,
    totalSalesAgg,
    sales,
    payments,
    creditSales,
    customers,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({ select: { quantity: true, basePrice: true } }),
    prisma.sale.aggregate({ _sum: { total: true, profit: true }, where: { createdAt: { gte: todayStart } } }),
    prisma.sale.aggregate({ _sum: { total: true, profit: true } }),
    prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { name: true } }, items: { include: { product: true } } },
    }),
    prisma.payment.findMany({ orderBy: { date: 'desc' }, take: 8, include: { creditSale: { include: { customer: true } }, user: { select: { name: true } } } }),
    prisma.creditSale.findMany({ select: { totalPrice: true, amountPaid: true, status: true } }),
    prisma.customer.findMany({ include: { creditSales: { select: { totalPrice: true, amountPaid: true } } } }),
  ])

  const stockValue = products.reduce((s, p) => s + p.quantity * p.basePrice, 0)
  const creditOutstanding = creditSales.reduce((s, cs) => s + (cs.totalPrice - cs.amountPaid), 0)
  const unpaidCreditCustomers = customers.filter((c) =>
    c.creditSales.some((cs) => cs.totalPrice - cs.amountPaid > 0)
  ).length

  const salesLast7 = await prisma.sale.findMany({
    where: { createdAt: { gte: weekAgo } },
    select: { createdAt: true, total: true, profit: true },
  })
  const salesLast30 = await prisma.sale.findMany({
    where: { createdAt: { gte: monthAgo } },
    select: { createdAt: true, total: true, profit: true },
  })
  const paymentsLast30 = await prisma.payment.findMany({
    where: { date: { gte: monthAgo } },
    select: { date: true, amount: true },
  })

  return NextResponse.json({
    stats: {
      productCount,
      stockValue,
      todaySales: todaySales._sum.total || 0,
      todayProfit: todaySales._sum.profit || 0,
      totalSales: totalSalesAgg._sum.total || 0,
      totalProfit: totalSalesAgg._sum.profit || 0,
      creditOutstanding,
      unpaidCreditCustomers,
    },
    recentSales: sales,
    recentPayments: payments,
    charts: {
      sales7: groupByDay(salesLast7),
      sales30: groupByDay(salesLast30),
      profit30: groupByDayProfit(salesLast30),
      payments30: groupByDay(paymentsLast30.map((p) => ({ createdAt: p.date, total: p.amount }))),
    },
  })
})

function groupByDay(
  data: { createdAt: Date }[],
  mapValue: (item: { createdAt: Date; total?: number; profit?: number }) => number = (i) => i.total ?? 0
) {
  const out: { label: string; value: number }[] = []
  const map = new Map<string, number>()
  for (const d of data) {
    const key = new Date(d.createdAt).toISOString().slice(0, 10)
    map.set(key, (map.get(key) || 0) + mapValue(d))
  }
  for (const [label, value] of map.entries()) {
    out.push({ label, value })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

function groupByDayProfit(data: { createdAt: Date; profit: number }[]) {
  return groupByDay(data, (i) => i.profit ?? 0)
}
