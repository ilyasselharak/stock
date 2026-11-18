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
// Units are taken from the stores first, then from the warehouse when the stores run
// out; returned units go back to the stores.
// -> { sku, quantity (total stock now: stores + warehouse), held (units taken by ref) }
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
    const total = product.quantity + product.warehouseQuantity
    if (delta === 0) return { sku: product.sku, quantity: total, held }

    if (delta > 0 && total < delta) {
      throw new ApiError(409, `Insufficient stock: ${total} left`)
    }

    // delta > 0 takes units (stores first), delta < 0 puts them back in the stores.
    const fromStore = delta > 0 ? Math.min(delta, Math.max(0, product.quantity)) : delta
    const fromWarehouse = delta - fromStore
    const updated = await tx.product.update({
      where: { id: product.id },
      data: {
        quantity: { decrement: fromStore },
        warehouseQuantity: { decrement: fromWarehouse },
      },
    })
    const reason = delta > 0 ? 'Commande vendeur ElectroDarna' : 'Annulation commande vendeur ElectroDarna'
    const parts = [
      { location: 'STORE' as const, units: fromStore },
      { location: 'WAREHOUSE' as const, units: fromWarehouse },
    ]
    for (const part of parts) {
      if (part.units === 0) continue
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: Math.abs(part.units),
          type: part.units > 0 ? 'OUT' : 'IN',
          location: part.location,
          reason,
          reference: ref,
        },
      })
    }
    return { sku: updated.sku, quantity: updated.quantity + updated.warehouseQuantity, held: quantity }
  })

  return NextResponse.json(result)
})
