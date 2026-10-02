import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'

const MAX_SKUS = 500

// Read-only stock levels for other apps (electro-darna affiliate products).
// Authenticated with `Authorization: Bearer $STOCK_SHARE_KEY`.
// POST { skus: string[] } -> { items: [{ sku, quantity }] }; unknown SKUs are left out.
export const POST = apiHandler(async function POST(request: NextRequest) {
  const key = process.env.STOCK_SHARE_KEY
  if (!key || request.headers.get('authorization') !== `Bearer ${key}`) {
    throw new ApiError(401, 'Unauthorized')
  }

  const body = await request.json().catch(() => null)
  const skus: unknown = body?.skus
  if (!Array.isArray(skus) || !skus.every((s) => typeof s === 'string')) {
    throw new ApiError(400, 'skus must be an array of strings')
  }
  if (skus.length > MAX_SKUS) throw new ApiError(400, `At most ${MAX_SKUS} skus per request`)

  const products = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { sku: true, quantity: true },
  })

  return NextResponse.json({ items: products })
})
