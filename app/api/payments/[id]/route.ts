import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
})

type Context = { params: Promise<{ id: string }> }

export const PUT = apiHandler(async function PUT(request: NextRequest, ctx: Context) {
  await requireAuth()
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 })
  }

  const body = await request.json()
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { creditSale: true },
  })
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const creditSale = payment.creditSale
  const newAmountPaid = creditSale.amountPaid - payment.amount + parsed.data.amount
  if (newAmountPaid > creditSale.totalPrice) {
    throw new ApiError(400, 'Payment exceeds remaining balance')
  }

  const status =
    newAmountPaid <= 0 ? 'UNPAID' : newAmountPaid >= creditSale.totalPrice ? 'COMPLETED' : 'PARTIALLY_PAID'

  const payments = await prisma.payment.findMany({
    where: { creditSaleId: creditSale.id },
    orderBy: { date: 'asc' },
  })

  const updates: { id: string; amount: number; remaining: number }[] = []
  let runningRemaining = creditSale.totalPrice
  for (const p of payments) {
    const amount = p.id === id ? parsed.data.amount : p.amount
    runningRemaining = Math.max(0, runningRemaining - amount)
    updates.push({ id: p.id, amount, remaining: runningRemaining })
  }

  await prisma.$transaction([
    prisma.creditSale.update({
      where: { id: creditSale.id },
      data: { amountPaid: newAmountPaid, status },
    }),
    ...updates.map((u) =>
      prisma.payment.update({
        where: { id: u.id },
        data: { amount: u.amount, remaining: u.remaining },
      })
    ),
  ])

  return NextResponse.json({ success: true })
})
