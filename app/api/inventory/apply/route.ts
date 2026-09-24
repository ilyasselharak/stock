import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'

const applySchema = z.object({
  counts: z.record(z.string(), z.coerce.number().int().min(0)),
})

// Sets each counted product's stock to the counted quantity. Products that were not
// counted are left untouched. Each change is logged as an ADJUSTMENT movement, whose
// quantity is the new absolute stock (same meaning as in /api/stock).
export const POST = apiHandler(async function POST(request: NextRequest) {
  const session = await requireAdmin()
  const parsed = applySchema.safeParse(await request.json())
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))
  const { counts } = parsed.data

  const ids = Object.keys(counts)
  if (ids.length === 0) throw new ApiError(400, 'Nothing counted')

  // Compare against the stock as it is now, not as it was when counting started.
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, quantity: true },
  })
  const changes = products.filter((p) => counts[p.id] !== p.quantity)

  if (changes.length > 0) {
    await prisma.$transaction(
      changes.flatMap((p) => [
        prisma.product.update({ where: { id: p.id }, data: { quantity: counts[p.id] } }),
        prisma.stockMovement.create({
          data: {
            productId: p.id,
            quantity: counts[p.id],
            type: 'ADJUSTMENT',
            reason: `Inventaire (${p.quantity} → ${counts[p.id]})`,
            userId: session.id,
          },
        }),
      ])
    )
  }

  return NextResponse.json({ updated: changes.length })
})
