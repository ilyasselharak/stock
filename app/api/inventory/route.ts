import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'

// Every product, unpaginated — a stock count needs the full list on one screen.
export const GET = apiHandler(async function GET() {
  await requireAuth()
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sku: true, brand: true, quantity: true, basePrice: true },
  })
  return NextResponse.json({ products })
})
