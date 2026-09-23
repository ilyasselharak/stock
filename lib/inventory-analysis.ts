// Pure comparison logic shared by the inventory page (client) and the PDF route (server).

export type InventoryProduct = {
  id: string
  name: string
  sku: string
  brand: string | null
  quantity: number
  basePrice: number
}

export type ExtraItem = { id: string; name: string; quantity: number }

export type InventoryLine = InventoryProduct & {
  counted: number
  diff: number
  valueDiff: number
}

export type InventoryAnalysis = {
  matched: InventoryLine[]
  surplus: InventoryLine[]
  shortage: InventoryLine[]
  notCounted: InventoryLine[]
  extras: ExtraItem[]
  totalProducts: number
  countedProducts: number
  expectedUnits: number
  countedUnits: number
  valueDiff: number
}

// `counts` only holds products the user actually touched. A product absent from it
// is "not counted"; a product present with 0 was counted and genuinely not found.
export function analyzeInventory(
  products: InventoryProduct[],
  counts: Record<string, number>,
  extras: ExtraItem[]
): InventoryAnalysis {
  const matched: InventoryLine[] = []
  const surplus: InventoryLine[] = []
  const shortage: InventoryLine[] = []
  const notCounted: InventoryLine[] = []

  for (const p of products) {
    const isCounted = Object.prototype.hasOwnProperty.call(counts, p.id)
    const counted = isCounted ? counts[p.id] : 0
    const diff = counted - p.quantity
    const line = { ...p, counted, diff, valueDiff: diff * p.basePrice }
    if (!isCounted) {
      // Products expected at 0 and never touched are consistent — nothing to report.
      if (p.quantity > 0) notCounted.push(line)
      else matched.push(line)
    } else if (diff === 0) matched.push(line)
    else if (diff > 0) surplus.push(line)
    else shortage.push(line)
  }

  surplus.sort((a, b) => b.diff - a.diff)
  shortage.sort((a, b) => a.diff - b.diff)
  notCounted.sort((a, b) => b.quantity - a.quantity)

  const counted = [...matched, ...surplus, ...shortage]
  return {
    matched,
    surplus,
    shortage,
    notCounted,
    extras,
    totalProducts: products.length,
    countedProducts: products.filter((p) => Object.prototype.hasOwnProperty.call(counts, p.id)).length,
    expectedUnits: products.reduce((s, p) => s + p.quantity, 0),
    countedUnits: counted.reduce((s, l) => s + l.counted, 0) + extras.reduce((s, e) => s + e.quantity, 0),
    valueDiff: [...surplus, ...shortage].reduce((s, l) => s + l.valueDiff, 0),
  }
}
