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

type Context = { params: Promise<{ id: string }> }

export const GET = apiHandler(async function GET(request: NextRequest, ctx: Context) {
  await requireAuth()
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'Missing sale ID' }, { status: 400 })
  }
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true, sku: true, imageUrl: true, basePrice: true } } } },
      user: { select: { name: true } },
    },
  })
  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  }
  return NextResponse.json(sale)
})

export const PUT = apiHandler(async function PUT(request: NextRequest, ctx: Context) {
  const session = await requireAuth()
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'Missing sale ID' }, { status: 400 })
  }
  const body = await request.json()
  const parsed = saleSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, zodMessage(parsed.error))
  }

  const existingSale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!existingSale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  }

  const { items } = parsed.data
  const productIds = [...new Set(items.map((i) => i.productId))]
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const productMap = new Map(products.map((p) => [p.id, p]))

  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product) throw new ApiError(404, 'Product not found')
    const original = existingSale.items.find((it) => it.productId === item.productId)
    const originalQty = original?.quantity ?? 0
    const netQty = item.quantity - originalQty
    if (netQty > 0 && netQty > product.quantity) {
      throw new ApiError(400, `Insufficient stock for ${product.name}`)
    }
  }

  let total = 0
  let profit = 0
  const newItems = items.map((item) => {
    const product = productMap.get(item.productId)!
    const itemTotal = item.price * item.quantity
    const itemProfit = (item.price - product.basePrice) * item.quantity
    total += itemTotal
    profit += itemProfit
    return {
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      total: itemTotal,
      profit: itemProfit,
    }
  })

  await prisma.$transaction(async (tx) => {
    for (const oldItem of existingSale.items) {
      await tx.product.update({
        where: { id: oldItem.productId },
        data: { quantity: { increment: oldItem.quantity } },
      })
    }

    await tx.saleItem.deleteMany({ where: { saleId: id } })

    await tx.sale.update({
      where: { id },
      data: {
        total,
        profit,
        items: { create: newItems },
      },
    })

    for (const item of newItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { decrement: item.quantity } },
      })
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          type: 'OUT',
          reason: 'Sale edited',
          userId: session.id,
        },
      })
    }
  })

  return NextResponse.json({ success: true })
})
