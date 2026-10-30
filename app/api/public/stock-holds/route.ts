import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'

// Lets other apps (electro-darna seller orders) take stock out and give it back.
// Authenticated with `Authorization: Bearer $STOCK_SHARE_KEY`.
//
// POST { ref, sku, quantity } sets how many units the order `ref` currently
// takes from product `sku` (0 = none, e.g. after a cancellation). Only the
// difference with what `ref` already took is applied, logged as an OUT or IN
// movement carrying `reference: ref`, so repeating a request is harmless.
// -> { sku, quantity (product stock now), held (units taken by ref) }
export const POST = apiHandler(async function POST(request: NextRequest) {
  const key = process.env.STOCK_SHARE_KEY
  if (!key || request.headers.get('authorization') !== `Bearer ${key}`) {
    throw new ApiError(401, 'Unauthorized')
  }

  const body = await request.json().catch(() => null)
  const ref: unknown = body?.ref
  const sku: unknown = body?.sku
  const quantity: unknown = body?.quantity
  if (typeof ref !== 'string' || !/^[\w:-]{3,100}$/.test(ref)) throw new ApiError(400, 'Invalid ref')
  if (typeof sku !== 'string' || !sku.trim()) throw new ApiError(400, 'Invalid sku')
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > 10000) {
    throw new ApiError(400, 'quantity must be an integer >= 0')
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { sku: sku.trim() } })
    if (!product) throw new ApiError(404, 'Unknown sku')

    const movements = await tx.stockMovement.findMany({
      where: { reference: ref, productId: product.id },
      select: { type: true, quantity: true },
    })
    const held = movements.reduce((sum, m) => sum + (m.type === 'OUT' ? m.quantity : m.type === 'IN' ? -m.quantity : 0), 0)
    const delta = quantity - held
    if (delta === 0) return { sku: product.sku, quantity: product.quantity, held }

    if (delta > 0 && product.quantity < delta) {
      throw new ApiError(409, `Insufficient stock: ${product.quantity} left`)
    }

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { quantity: { decrement: delta } },
    })
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        quantity: Math.abs(delta),
        type: delta > 0 ? 'OUT' : 'IN',
        reason: delta > 0 ? 'Commande vendeur ElectroDarna' : 'Annulation commande vendeur ElectroDarna',
        reference: ref,
      },
    })
    return { sku: updated.sku, quantity: updated.quantity, held: quantity }
  })

  return NextResponse.json(result)
})
