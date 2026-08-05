import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        price: z.coerce.number().positive(),
      })
    )
    .min(1),
})

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 10
  const skip = (page - 1) * limit
  const period = searchParams.get('period') || 'all'

  let dateFilter = {}
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now.setHours(0, 0, 0, 0))
    dateFilter = { gte: start }
  } else if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 7)
    dateFilter = { gte: start }
  } else if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    dateFilter = { gte: start }
  }

  const where = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, imageUrl: true } } } },
      },
    }),
    prisma.sale.count({ where }),
  ])

  return NextResponse.json({ sales, total, page, totalPages: Math.ceil(total / limit) })
})

export const POST = apiHandler(async function POST(request: NextRequest) {
  await requireAuth()
  const session = await requireAuth()
  const body = await request.json()
  const parsed = saleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, zodMessage(parsed.error))
  }

  const { items } = parsed.data
  let total = 0
  let profit = 0

  const saleItems: {
    productId: string
    quantity: number
    price: number
    total: number
    profit: number
  }[] = []
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } })
    if (!product) throw new ApiError(404, 'Product not found')
    if (item.quantity > product.quantity) {
      throw new ApiError(400, `Insufficient stock for ${product.name}`)
    }
    const itemTotal = item.price * item.quantity
    const itemProfit = (item.price - product.basePrice) * item.quantity
    total += itemTotal
    profit += itemProfit
    saleItems.push({
      productId: product.id,
      quantity: item.quantity,
      price: item.price,
      total: itemTotal,
      profit: itemProfit,
    })
  }

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        total,
        profit,
        userId: session.id,
        items: { create: saleItems },
      },
      include: { items: true },
    })

    for (const item of saleItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { decrement: item.quantity } },
      })
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          type: 'OUT',
          reason: 'Sale',
          userId: session.id,
        },
      })
    }
    return created
  })

  return NextResponse.json(sale, { status: 201 })
})
