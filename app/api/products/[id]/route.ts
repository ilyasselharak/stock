import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ApiError } from '@/lib/permissions'
import { uploadImage } from '@/lib/cloudinary'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  brand: z.string().optional().nullable(),
  basePrice: z.coerce.number().min(0),
  image: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(0).optional(),
  warehouseQuantity: z.coerce.number().int().min(0).optional(),
})

export const PUT = apiHandler(async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const { id } = await params
  const body = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, zodMessage(parsed.error))
  }
  const { name, sku, brand, basePrice, image, imageUrl, quantity, warehouseQuantity } = parsed.data

  const dup = await prisma.product.findFirst({ where: { sku, NOT: { id } } })
  if (dup) throw new ApiError(400, 'SKU already exists')

  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) throw new ApiError(404, 'Product not found')

  let finalImage = imageUrl
  if (image) {
    finalImage = await uploadImage(image)
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: {
        name,
        sku,
        brand,
        basePrice,
        ...(finalImage !== undefined ? { imageUrl: finalImage } : {}),
        ...(quantity !== undefined ? { quantity } : {}),
        ...(warehouseQuantity !== undefined ? { warehouseQuantity } : {}),
      },
    })

    const changes = [
      { location: 'STORE' as const, next: quantity, prev: existing.quantity },
      { location: 'WAREHOUSE' as const, next: warehouseQuantity, prev: existing.warehouseQuantity },
    ]
    for (const c of changes) {
      if (c.next === undefined || c.next === c.prev) continue
      const diff = c.next - c.prev
      await tx.stockMovement.create({
        data: {
          productId: id,
          quantity: Math.abs(diff),
          type: diff > 0 ? 'IN' : 'OUT',
          location: c.location,
          reason: 'Stock update from product edit',
          userId: session.id,
        },
      })
    }
    return product
  })

  return NextResponse.json(result)
})
