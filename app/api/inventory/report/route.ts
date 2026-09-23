import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ApiError } from '@/lib/permissions'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { apiHandler } from '@/lib/api-handler'
import { analyzeInventory, type InventoryLine } from '@/lib/inventory-analysis'
import {
  AMBER,
  EMERALD,
  MARGIN,
  ROSE,
  SLATE_700,
  createReportDoc,
  drawFooter,
  drawHeaderBand,
  drawKpiGrid,
  drawTable,
  formatDateTime,
  formatMoney,
  sectionTitle,
  type Column,
} from '@/lib/pdf-report-kit'

const reportSchema = z.object({
  counts: z.record(z.string(), z.coerce.number().int().min(0)),
  extras: z
    .array(z.object({ id: z.string(), name: z.string().min(1), quantity: z.coerce.number().int().min(0) }))
    .default([]),
  startedAt: z.string().optional().nullable(),
})

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n)
}

export const POST = apiHandler(async function POST(request: NextRequest) {
  const session = await requireAuth()
  const parsed = reportSchema.safeParse(await request.json())
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))
  const { counts, extras, startedAt } = parsed.data

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sku: true, brand: true, quantity: true, basePrice: true },
  })
  const a = analyzeInventory(products, counts, extras)
  const now = new Date()

  const { doc, done } = createReportDoc()
  const contentW = doc.page.width - MARGIN * 2
  const title = "Rapport d'inventaire"

  const started = startedAt ? new Date(startedAt) : null
  drawHeaderBand(
    doc,
    title,
    `${started && !isNaN(started.getTime()) ? `Commencé le ${formatDateTime(started)}  ·  ` : ''}Généré le ${formatDateTime(now)}  ·  ${session.name}`
  )

  drawKpiGrid(
    doc,
    [
      { label: 'Produits comptés', value: `${a.countedProducts} / ${a.totalProducts}`, color: SLATE_700 },
      { label: 'Unités attendues', value: String(a.expectedUnits), color: SLATE_700 },
      { label: 'Unités comptées', value: String(a.countedUnits), color: SLATE_700 },
      { label: 'Conformes', value: String(a.matched.length), color: EMERALD },
      { label: 'Écarts', value: String(a.surplus.length + a.shortage.length), color: a.surplus.length + a.shortage.length ? ROSE : EMERALD },
      { label: 'Écart en valeur', value: formatMoney(a.valueDiff), color: a.valueDiff < 0 ? ROSE : a.valueDiff > 0 ? AMBER : EMERALD },
    ],
    3
  )

  const diffColumns: Column<InventoryLine>[] = [
    { label: 'PRODUIT', width: contentW - 90 - 60 - 60 - 60 - 90, value: (l) => l.name },
    { label: 'SKU', width: 90, value: (l) => l.sku },
    { label: 'ATTENDU', width: 60, align: 'right', value: (l) => String(l.quantity) },
    { label: 'COMPTÉ', width: 60, align: 'right', value: (l) => String(l.counted) },
    { label: 'ÉCART', width: 60, align: 'right', value: (l) => signed(l.diff), color: (l) => (l.diff < 0 ? ROSE : AMBER) },
    { label: 'VALEUR', width: 90, align: 'right', value: (l) => formatMoney(l.valueDiff), color: (l) => (l.diff < 0 ? ROSE : AMBER) },
  ]

  sectionTitle(doc, `Manquants — compté moins que le stock (${a.shortage.length})`, MARGIN, contentW)
  drawTable(doc, MARGIN, contentW, diffColumns, a.shortage, 'Aucun produit manquant.')

  sectionTitle(doc, `Excédents — compté plus que le stock (${a.surplus.length})`, MARGIN, contentW)
  drawTable(doc, MARGIN, contentW, diffColumns, a.surplus, 'Aucun excédent.')

  sectionTitle(doc, `Non comptés (${a.notCounted.length})`, MARGIN, contentW)
  drawTable<InventoryLine>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'PRODUIT', width: contentW - 110 - 80 - 110, value: (l) => l.name },
      { label: 'SKU', width: 110, value: (l) => l.sku },
      { label: 'EN STOCK', width: 80, align: 'right', value: (l) => String(l.quantity) },
      { label: 'VALEUR', width: 110, align: 'right', value: (l) => formatMoney(l.quantity * l.basePrice) },
    ],
    a.notCounted,
    'Tous les produits ont été comptés.'
  )

  sectionTitle(doc, `Trouvés hors système (${a.extras.length})`, MARGIN, contentW)
  drawTable<(typeof a.extras)[number]>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'ARTICLE', width: contentW - 100, value: (e) => e.name },
      { label: 'COMPTÉ', width: 100, align: 'right', value: (e) => String(e.quantity), color: () => AMBER },
    ],
    a.extras,
    'Aucun article hors système.'
  )

  sectionTitle(doc, `Conformes (${a.matched.length})`, MARGIN, contentW)
  drawTable<InventoryLine>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'PRODUIT', width: contentW - 120 - 80, value: (l) => l.name },
      { label: 'SKU', width: 120, value: (l) => l.sku },
      { label: 'QUANTITÉ', width: 80, align: 'right', value: (l) => String(l.counted), color: () => EMERALD },
    ],
    a.matched,
    'Aucun produit conforme.'
  )

  drawFooter(doc, title, formatDateTime(now))

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inventaire-${now.toISOString().slice(0, 10)}.pdf"`,
    },
  })
})
