import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'
import { getDailyActivity } from '@/lib/daily-activity-data'
import {
  EMERALD,
  MARGIN,
  SLATE_700,
  createReportDoc,
  drawFooter,
  drawHeaderBand,
  drawKpiGrid,
  drawTable,
  ensureSpace,
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
  sectionTitle,
} from '@/lib/pdf-report-kit'

export const GET = apiHandler(async function GET() {
  await requireAuth()

  const { date, sales, payments, totalRevenue, totalPaymentsReceived } = await getDailyActivity()

  const { doc, done } = createReportDoc()
  const contentW = doc.page.width - MARGIN * 2

  drawHeaderBand(
    doc,
    "Journal d'activité du jour",
    `${formatDate(date)}  ·  Généré le ${formatDateTime(new Date())}`
  )

  drawKpiGrid(
    doc,
    [
      { label: 'Ventes du jour', value: String(sales.length), color: SLATE_700 },
      { label: "Chiffre d'affaires", value: formatMoney(totalRevenue), color: EMERALD },
      { label: 'Paiements reçus', value: formatMoney(totalPaymentsReceived), color: EMERALD },
    ],
    3
  )

  // ---------- Sales, itemized ----------
  sectionTitle(doc, `Ventes du jour (${sales.length})`, MARGIN, contentW)
  if (sales.length === 0) {
    ensureSpace(doc, 30)
    doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(9).text('Aucune vente aujourd’hui.', MARGIN, doc.y, { width: contentW })
    doc.y += 24
  } else {
    for (const sale of sales) {
      ensureSpace(doc, 24)
      const y = doc.y
      doc.fillColor(SLATE_700).font('Helvetica-Bold').fontSize(9.5).text(
        `${formatTime(sale.createdAt)}  ·  ${sale.user?.name || ''}`,
        MARGIN,
        y,
        { width: contentW * 0.6 }
      )
      doc.fillColor(EMERALD).font('Helvetica-Bold').fontSize(9.5).text(formatMoney(sale.total), MARGIN, y, {
        width: contentW,
        align: 'right',
      })
      doc.y = y + 16

      drawTable<(typeof sale.items)[number]>(
        doc,
        MARGIN + 12,
        contentW - 12,
        [
          { label: 'PRODUIT', width: contentW - 12 - 60 - 100 - 100, value: (it) => it.product.name },
          { label: 'QTÉ', width: 60, align: 'right', value: (it) => String(it.quantity) },
          { label: 'PRIX', width: 100, align: 'right', value: (it) => formatMoney(it.price) },
          { label: 'TOTAL', width: 100, align: 'right', value: (it) => formatMoney(it.total) },
        ],
        sale.items,
        'Aucun article.'
      )
      doc.y += 4
    }
  }

  // ---------- Credit payments ----------
  sectionTitle(doc, `Paiements reçus — crédit (${payments.length})`, MARGIN, contentW)
  drawTable<(typeof payments)[number]>(
    doc,
    MARGIN,
    contentW,
    [
      { label: 'HEURE', width: 90, value: (p) => formatTime(p.date) },
      { label: 'CLIENT', width: contentW - 90 - 110 - 120, value: (p) => p.creditSale?.customer?.fullName || '—' },
      { label: 'MONTANT', width: 110, align: 'right', value: (p) => formatMoney(p.amount), color: () => EMERALD },
      { label: 'UTILISATEUR', width: 120, value: (p) => p.user?.name || '' },
    ],
    payments,
    'Aucun paiement reçu aujourd’hui.'
  )

  drawFooter(doc, "Journal d'activité du jour", formatMoney(totalRevenue + totalPaymentsReceived))

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="journal-${date.toISOString().slice(0, 10)}.pdf"`,
    },
  })
})
