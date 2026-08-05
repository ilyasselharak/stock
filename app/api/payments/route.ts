import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const paymentSchema = z.object({
  creditSaleId: z.string().min(1),
  amount: z.coerce.number().positive(),
})

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 15
  const skip = (page - 1) * limit

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { name: true } },
        creditSale: { include: { customer: true } },
      },
    }),
    prisma.payment.count(),
  ])

  return NextResponse.json({ payments, total, page, totalPages: Math.ceil(total / limit) })
})

export const POST = apiHandler(async function POST(request: NextRequest) {
  await requireAuth()
  const session = await requireAuth()
  const body = await request.json()
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))

  const { creditSaleId, amount } = parsed.data
  const creditSale = await prisma.creditSale.findUnique({ where: { id: creditSaleId } })
  if (!creditSale) throw new ApiError(404, 'Credit sale not found')

  const remaining = creditSale.totalPrice - creditSale.amountPaid
  if (amount > remaining) {
    throw new ApiError(400, `Payment exceeds remaining balance (${remaining})`)
  }

  const newAmountPaid = creditSale.amountPaid + amount
  const newRemaining = creditSale.totalPrice - newAmountPaid
  const status =
    newAmountPaid <= 0 ? 'UNPAID' : newAmountPaid >= creditSale.totalPrice ? 'COMPLETED' : 'PARTIALLY_PAID'

  const payment = await prisma.$transaction([
    prisma.creditSale.update({
      where: { id: creditSaleId },
      data: { amountPaid: newAmountPaid, status },
    }),
    prisma.payment.create({
      data: {
        creditSaleId,
        amount,
        remaining: newRemaining,
        userId: session.id,
      },
    }),
  ])

  return NextResponse.json(payment[1], { status: 201 })
})
