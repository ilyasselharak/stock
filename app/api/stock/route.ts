import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { StockMovementType } from '@prisma/client'
import { apiHandler } from '@/lib/api-handler'

const stockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER']),
  // Which stock IN/OUT/ADJUSTMENT apply to. For TRANSFER it is the destination:
  // STORE = warehouse → stores, WAREHOUSE = stores → warehouse.
  location: z.enum(['STORE', 'WAREHOUSE']).default('STORE'),
  reason: z.string().optional().nullable(),
})

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 15
  const skip = (page - 1) * limit

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: { product: true, user: { select: { name: true } } },
    }),
    prisma.stockMovement.count(),
  ])

  return NextResponse.json({ movements, total, page, totalPages: Math.ceil(total / limit) })
})

export const POST = apiHandler(async function POST(request: NextRequest) {
  const session = await requireAdmin()
  const body = await request.json()
  const parsed = stockSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, zodMessage(parsed.error))
  }
  const { productId, quantity, type, location, reason } = parsed.data
  if (quantity <= 0 && type !== 'ADJUSTMENT') throw new ApiError(400, 'Quantity must be positive')
  if (quantity < 0) throw new ApiError(400, 'Quantity must not be negative')

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new ApiError(404, 'Product not found')

  let store = product.quantity
  let warehouse = product.warehouseQuantity
  const current = location === 'STORE' ? store : warehouse
  let next = current
  if (type === 'IN') next = current + quantity
  else if (type === 'OUT') {
    if (quantity > current) throw new ApiError(400, `Insufficient stock: ${current} left`)
    next = current - quantity
  } else if (type === 'ADJUSTMENT') next = quantity

  if (type === 'TRANSFER') {
    // `location` is the destination; the source is the other stock.
    const source = location === 'STORE' ? warehouse : store
    if (quantity > source) throw new ApiError(400, `Insufficient stock: ${source} left`)
    if (location === 'STORE') {
      warehouse -= quantity
      store += quantity
    } else {
      store -= quantity
      warehouse += quantity
    }
  } else if (location === 'STORE') store = next
  else warehouse = next

  const result = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { quantity: store, warehouseQuantity: warehouse },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        quantity,
        type: type as StockMovementType,
        location,
        reason,
        userId: session.id,
      },
    }),
  ])

  return NextResponse.json({ product: result[0], movement: result[1] })
})
