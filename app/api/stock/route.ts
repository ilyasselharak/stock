import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { StockMovementType } from '@prisma/client'
import { apiHandler } from '@/lib/api-handler'

const stockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
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
  await requireAuth()
  const body = await request.json()
  const parsed = stockSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, zodMessage(parsed.error))
  }
  const { productId, quantity, type, reason } = parsed.data
  if (quantity <= 0) throw new ApiError(400, 'Quantity must be positive')

  const session = await requireAuth()
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new ApiError(404, 'Product not found')

  let newQuantity = product.quantity
  if (type === 'IN') newQuantity += quantity
  else if (type === 'OUT') {
    if (quantity > product.quantity) throw new ApiError(400, 'Insufficient stock')
    newQuantity -= quantity
  } else {
    newQuantity = quantity
  }

  const result = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { quantity: newQuantity },
    }),
    prisma.stockMovement.create({
      data: {
        productId,
        quantity,
        type: type as StockMovementType,
        reason,
        userId: session.id,
      },
    }),
  ])

  return NextResponse.json({ product: result[0], movement: result[1] })
})
