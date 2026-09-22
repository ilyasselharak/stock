import { prisma } from '@/lib/prisma'

export async function getDailyActivity(date: Date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const [sales, payments] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
      include: { user: { select: { name: true } }, creditSale: { include: { customer: true } } },
    }),
  ])

  const totalRevenue = sales.reduce((s, x) => s + x.total, 0)
  const totalPaymentsReceived = payments.reduce((s, x) => s + x.amount, 0)

  return { date: start, sales, payments, totalRevenue, totalPaymentsReceived }
}
