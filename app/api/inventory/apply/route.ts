import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const applySchema = z.object({
  counts: z.record(z.string(), z.coerce.number().int().min(0)),
  // Keep each product's total: the difference between the count and the store stock is
  // taken from (or put back into) the warehouse instead of being a gain or loss.
  fromWarehouse: z.boolean().default(false),
})

// The inventory counts the stores only. Sets each product in `counts` to the given
// store quantity; products absent from `counts` are left untouched (the client sends 0
// for uncounted products when the admin chooses to zero them). Each change is logged
// as an ADJUSTMENT movement whose quantity is the new absolute stock (same meaning as
// in /api/stock).
export const POST = apiHandler(async function POST(request: NextRequest) {
  const session = await requireAdmin()
  const parsed = applySchema.safeParse(await request.json())
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))
  const { counts, fromWarehouse } = parsed.data

  const ids = Object.keys(counts)
  if (ids.length === 0) throw new ApiError(400, 'Nothing counted')

  // Compare against the stock as it is now, not as it was when counting started.
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, quantity: true, warehouseQuantity: true },
  })
  const changes = products.filter((p) => counts[p.id] !== p.quantity)

  if (changes.length > 0) {
    await prisma.$transaction(
      changes.flatMap((p) => {
        const store = counts[p.id]
        // Never below 0: if the warehouse can't cover the extra units, they count as found.
        const warehouse = fromWarehouse ? Math.max(0, p.warehouseQuantity - (store - p.quantity)) : p.warehouseQuantity
        return [
          prisma.product.update({ where: { id: p.id }, data: { quantity: store, warehouseQuantity: warehouse } }),
          prisma.stockMovement.create({
            data: {
              productId: p.id,
              quantity: store,
              type: 'ADJUSTMENT',
              location: 'STORE',
              reason: `Inventaire magasins (${p.quantity} → ${store})`,
              userId: session.id,
            },
          }),
          ...(warehouse !== p.warehouseQuantity
            ? [
                prisma.stockMovement.create({
                  data: {
                    productId: p.id,
                    quantity: warehouse,
                    type: 'ADJUSTMENT' as const,
                    location: 'WAREHOUSE' as const,
                    reason: `Inventaire magasins, différence prise dans l’entrepôt (${p.warehouseQuantity} → ${warehouse})`,
                    userId: session.id,
                  },
                }),
              ]
            : []),
        ]
      })
    )
  }

  return NextResponse.json({ updated: changes.length })
})
