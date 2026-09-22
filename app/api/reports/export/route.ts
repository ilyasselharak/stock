import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'
import { getReportData } from '@/lib/reports-data'
import {
  AMBER,
  EMERALD,
  MARGIN,
  ROSE,
  SLATE_800,
  createReportDoc,
  drawFooter,
  drawHeaderBand,
  drawKpiGrid,
  drawTable,
  formatDate,
  formatDateTime,
  formatMoney,
  sectionTitle,
} from '@/lib/pdf-report-kit'

const LABELS: Record<string, string> = {
  all: 'Toute la période',
  today: "Aujourd'hui",
  week: '7 derniers jours',
  month: 'Ce mois-ci',
}

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'all'

  const { summary, topProducts, lowStock, sales, recentPayments } = await getReportData(period)

  const { doc, done } = createReportDoc()
  const contentW = doc.page.width - MARGIN * 2

  drawHeaderBand(
    doc,
    'Rapport de gestion',
    `${LABELS[period] || LABELS.all}  ·  Généré le ${formatDateTime(new Date())}`
  )

  // ---------- KPI grid ----------
  const kpis = [
    { label: 'Revenus totaux', value: formatMoney(summary.totalRevenue), color: SLATE_800 },
    { label: 'Profit total', value: formatMoney(summary.totalProfit), color: EMERALD },
    { label: 'Nombre de ventes', value: String(summary.totalSales), color: SLATE_800 },
    { label: 'Paiements reçus', value: formatMoney(summary.totalPayments), color: SLATE_800 },
    { label: 'Crédit en cours', value: formatMoney(summary.creditOutstanding), color: AMBER },
    { label: 'Valeur du stock', value: formatMoney(summary.stockValue), color: SLATE_800 },
  ]
  drawKpiGrid(doc, kpis, 3)

  // ---------- Top products ----------
  sectionTitle(doc, 'Produits les plus vendus', MARGIN, contentW)
  drawTable<(typeof topProducts)[number]>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'PRODUIT', width: contentW - 80 - 100 - 100, value: (p) => p.name },
      { label: 'QTÉ', width: 80, align: 'right', value: (p) => String(p.sold) },
      { label: 'REVENUS', width: 100, align: 'right', value: (p) => formatMoney(p.revenue) },
      { label: 'PROFIT', width: 100, align: 'right', value: (p) => formatMoney(p.profit), color: () => EMERALD },
    ],
    topProducts,
    'Aucune vente sur cette période.'
  )

  // ---------- Low stock ----------
  sectionTitle(doc, 'Stock faible (5 unités ou moins)', MARGIN, contentW)
  drawTable<(typeof lowStock)[number]>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'PRODUIT', width: contentW - 120 - 100, value: (p) => p.name },
      { label: 'SKU', width: 120, value: (p) => p.sku },
      {
        label: 'QUANTITÉ',
        width: 100,
        align: 'right',
        value: (p) => String(p.quantity),
        color: (p) => (p.quantity === 0 ? ROSE : AMBER),
      },
    ],
    lowStock,
    'Aucun produit en stock faible.'
  )

  // ---------- Payments ----------
  sectionTitle(doc, 'Paiements récents', MARGIN, contentW)
  drawTable<(typeof recentPayments)[number]>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'DATE', width: 130, value: (p) => formatDate(new Date(p.date)) },
      { label: 'CLIENT', width: contentW - 130 - 110 - 110, value: (p) => p.creditSale?.customer?.fullName || '—' },
      { label: 'MONTANT', width: 110, align: 'right', value: (p) => formatMoney(p.amount), color: () => EMERALD },
      { label: 'UTILISATEUR', width: 110, value: (p) => p.user?.name || '' },
    ],
    recentPayments,
    'Aucun paiement sur cette période.'
  )

  // ---------- Sales ledger ----------
  sectionTitle(doc, `Détail des ventes (${sales.length})`, MARGIN, contentW)
  drawTable<(typeof sales)[number]>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'DATE', width: 140, value: (s) => formatDate(s.createdAt) },
      { label: 'TOTAL', width: (contentW - 140) / 3, align: 'right', value: (s) => formatMoney(s.total) },
      {
        label: 'PROFIT',
        width: (contentW - 140) / 3,
        align: 'right',
        value: (s) => formatMoney(s.profit),
        color: () => EMERALD,
      },
      { label: 'UTILISATEUR', width: (contentW - 140) / 3, value: (s) => s.user?.name || '' },
    ],
    sales,
    'Aucune vente sur cette période.'
  )

  drawFooter(doc, 'Rapport de gestion', formatMoney(summary.totalRevenue))

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rapport-${period}.pdf"`,
    },
  })
})
