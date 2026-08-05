import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { PaymentStatus } from '@prisma/client'
import { apiHandler } from '@/lib/api-handler'

const creditSaleItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
})

const creditSaleSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(creditSaleItemSchema).min(1),
  initialPayment: z.coerce.number().min(0),
  monthlyAmount: z.coerce.number().positive(),
})

function computeStatus(totalPrice: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return 'UNPAID'
  if (amountPaid >= totalPrice) return 'COMPLETED'
  return 'PARTIALLY_PAID'
}

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 10
  const skip = (page - 1) * limit

  const where = customerId ? { customerId } : {}

  const [creditSales, total] = await Promise.all([
    prisma.creditSale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        customer: true,
        createdByUser: { select: { name: true } },
        payments: { orderBy: { date: 'desc' } },
        items: true,
      },
    }),
    prisma.creditSale.count({ where }),
  ])

  return NextResponse.json({ creditSales, total, page, totalPages: Math.ceil(total / limit) })
})

export const POST = apiHandler(async function POST(request: NextRequest) {
  await requireAuth()
  const session = await requireAuth()
  const body = await request.json()
  const parsed = creditSaleSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))

  const { customerId, items, initialPayment, monthlyAmount } = parsed.data

  let totalPrice = 0
  for (const item of items) {
    totalPrice += item.price * item.quantity
  }
  if (initialPayment > totalPrice) {
    throw new ApiError(400, 'Initial payment cannot exceed total price')
  }

  const status = computeStatus(totalPrice, initialPayment)
  const productName = items.map((i) => i.productName).join(', ')

  const creditSale = await prisma.$transaction(async (tx) => {
    const created = await tx.creditSale.create({
      data: {
        customerId,
        productName,
        totalPrice,
        initialPayment,
        monthlyAmount,
        amountPaid: initialPayment,
        status,
        userId: session.id,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            price: i.price,
            total: i.price * i.quantity,
          })),
        },
        payments:
          initialPayment > 0
            ? {
                create: {
                  amount: initialPayment,
                  remaining: totalPrice - initialPayment,
                  userId: session.id,
                },
              }
            : undefined,
      },
      include: { payments: true, items: true },
    })
    return created
  })

  return NextResponse.json(creditSale, { status: 201 })
})
