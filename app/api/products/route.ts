import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin, ApiError } from '@/lib/permissions'
import { uploadImage } from '@/lib/cloudinary'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  brand: z.string().optional().nullable(),
  basePrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0).optional().default(0),
  image: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
})

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const rawLimit = parseInt(searchParams.get('limit') || '10')
  const limit = Math.min(rawLimit, 500)
  const skip = (page - 1) * limit

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { brand: { contains: q } },
        ],
      }
    : {}

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ])

  return NextResponse.json({ products, total, page, totalPages: Math.ceil(total / limit) })
})

export const POST = apiHandler(async function POST(request: NextRequest) {
  await requireAdmin()
  const body = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, zodMessage(parsed.error))
  }
  const { name, sku, brand, basePrice, quantity, image, imageUrl } = parsed.data

  const existing = await prisma.product.findUnique({ where: { sku } })
  if (existing) throw new ApiError(400, 'SKU already exists')

  let finalImage = imageUrl || null
  if (image) {
    finalImage = await uploadImage(image)
  }

  const product = await prisma.product.create({
    data: { name, brand, sku, basePrice, imageUrl: finalImage, quantity },
  })
  return NextResponse.json(product, { status: 201 })
})

export const DELETE = apiHandler(async function DELETE(request: NextRequest) {
  await requireAdmin()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) throw new ApiError(400, 'Product id required')

  await prisma.$transaction(async (tx) => {
    const saleItems = await tx.saleItem.findMany({ where: { productId: id }, select: { saleId: true } })
    const saleIds = [...new Set(saleItems.map((i) => i.saleId))]
    await tx.saleItem.deleteMany({ where: { productId: id } })
    await tx.stockMovement.deleteMany({ where: { productId: id } })
    const orphaned = await tx.sale.findMany({
      where: { id: { in: saleIds }, items: { none: {} } },
      select: { id: true },
    })
    await tx.sale.deleteMany({ where: { id: { in: orphaned.map((s) => s.id) } } })
    await tx.product.delete({ where: { id } })
  })

  return NextResponse.json({ ok: true })
})
