import { prisma } from '@/lib/prisma'

const BATCH_SIZE = 5

// The only part that depends on the external system: returns the stock it reports for
// each SKU. SKUs that fail or are unknown are left out of the map, so their stock is
// kept as it is (never reset to 0).
// Adjust the URL, auth header and quantity field to match the external API. If it can
// return every product in one call (e.g. GET /stock -> [{ sku, qty }]), make a single
// request here instead of one per SKU.
async function fetchExternalStock(skus: string[]): Promise<Map<string, number>> {
  const baseUrl = process.env.STOCK_API_URL
  const apiKey = process.env.STOCK_API_KEY
  if (!baseUrl || !apiKey) throw new Error('STOCK_API_URL / STOCK_API_KEY are not configured')

  async function fetchOne(sku: string): Promise<number | null> {
    try {
      const res = await fetch(`${baseUrl}/products/${encodeURIComponent(sku)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      })
      if (!res.ok) return null
      const data = await res.json()
      const qty = Number(data.quantity) // field holding the stock in their response
      return Number.isFinite(qty) ? Math.max(0, Math.trunc(qty)) : null
    } catch {
      return null
    }
  }

  const stock = new Map<string, number>()
  // Small batches so the external API is not flooded.
  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batch = skus.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(fetchOne))
    batch.forEach((sku, j) => {
      if (results[j] !== null) stock.set(sku, results[j])
    })
  }
  return stock
}

// Reads every product's SKU from the external system and sets the local stock to it.
// Each change is logged as an ADJUSTMENT movement whose quantity is the new absolute
// stock (same meaning as in /api/stock and /api/inventory/apply).
export async function syncStockFromExternal(userId: string) {
  const products = await prisma.product.findMany({ select: { id: true, sku: true, quantity: true } })
  const external = await fetchExternalStock(products.map((p) => p.sku))

  const changes = products.filter((p) => external.has(p.sku) && external.get(p.sku) !== p.quantity)

  if (changes.length > 0) {
    await prisma.$transaction(
      changes.flatMap((p) => {
        const qty = external.get(p.sku)!
        return [
          prisma.product.update({ where: { id: p.id }, data: { quantity: qty } }),
          prisma.stockMovement.create({
            data: {
              productId: p.id,
              quantity: qty,
              type: 'ADJUSTMENT',
              reason: `Synchro externe (${p.quantity} → ${qty})`,
              userId,
            },
          }),
        ]
      })
    )
  }

  return { checked: products.length, found: external.size, updated: changes.length }
}
