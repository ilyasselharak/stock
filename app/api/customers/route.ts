import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const customerSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 10
  const skip = (page - 1) * limit

  const where = q
    ? { OR: [{ fullName: { contains: q } }, { phone: { contains: q } }] }
    : {}

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { creditSales: { include: { payments: { select: { date: true } } } } },
    }),
    prisma.customer.count({ where }),
  ])

  const data = customers.map((c) => {
    const totalDue = c.creditSales.reduce((s, cs) => s + cs.totalPrice, 0)
    const totalPaid = c.creditSales.reduce((s, cs) => s + cs.amountPaid, 0)
    const lastPayment = c.creditSales
      .flatMap((cs) => cs.payments)
      .reduce<Date | null>((latest, p) => (latest && p.date <= latest ? latest : p.date), null)
    return {
      id: c.id,
      fullName: c.fullName,
      phone: c.phone,
      address: c.address,
      notes: c.notes,
      createdAt: c.createdAt,
      balance: totalDue - totalPaid,
      lastPaymentDate: lastPayment ? lastPayment.toISOString() : null,
      creditSales: c.creditSales.map((cs) => ({
        id: cs.id,
        totalPrice: cs.totalPrice,
        amountPaid: cs.amountPaid,
        status: cs.status,
      })),
    }
  })

  return NextResponse.json({ customers: data, total, page, totalPages: Math.ceil(total / limit) })
})

export const POST = apiHandler(async function POST(request: NextRequest) {
  await requireAuth()
  const body = await request.json()
  const parsed = customerSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))
  const customer = await prisma.customer.create({ data: parsed.data })
  return NextResponse.json(customer, { status: 201 })
})

export const PUT = apiHandler(async function PUT(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) throw new ApiError(400, 'Customer id required')
  const body = await request.json()
  const parsed = customerSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))
  const customer = await prisma.customer.update({ where: { id }, data: parsed.data })
  return NextResponse.json(customer)
})

export const DELETE = apiHandler(async function DELETE(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) throw new ApiError(400, 'Customer id required')
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { creditSales: { select: { id: true } } },
  })
  if (customer && customer.creditSales.length > 0) {
    throw new ApiError(400, 'Cannot delete customer with credit sales')
  }
  await prisma.customer.delete({ where: { id } })
  return NextResponse.json({ ok: true })
})
