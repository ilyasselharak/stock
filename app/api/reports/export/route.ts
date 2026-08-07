import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/permissions'
import { apiHandler } from '@/lib/api-handler'
import PDFDocument from 'pdfkit'

const LABELS: Record<string, string> = {
  all: 'Rapport des ventes (tous)',
  today: 'Rapport des ventes du jour',
  week: 'Rapport des ventes (7 jours)',
  month: 'Rapport mensuel des ventes',
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' MAD'
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export const GET = apiHandler(async function GET(request: NextRequest) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'month'
  const now = new Date()

  let dateFilter: { gte?: Date } = {}
  if (period === 'today') dateFilter = { gte: new Date(now.setHours(0, 0, 0, 0)) }
  else if (period === 'week') dateFilter = { gte: new Date(now.getTime() - 7 * 86400000) }
  else if (period === 'month') dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) }

  const where = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } },
  })

  const totalRevenue = sales.reduce((s, x) => s + x.total, 0)
  const totalProfit = sales.reduce((s, x) => s + x.profit, 0)

  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const headerColor = '#4338ca'
  const lineColor = '#e2e8f0'

  doc.fontSize(18).fillColor(headerColor).text(LABELS[period] || LABELS.month, { align: 'center' })
  doc.moveDown(0.4)
  doc.fontSize(10).fillColor('#64748b').text(`Généré le ${formatDate(new Date())}`, { align: 'center' })
  doc.moveDown(1)

  const summary = [
    { label: 'Nombre de ventes', value: String(sales.length) },
    { label: 'Revenus totaux', value: formatMoney(totalRevenue) },
    { label: 'Profit total', value: formatMoney(totalProfit) },
  ]
  const colW = (doc.page.width - 80) / 3
  summary.forEach((s, i) => {
    const x = 40 + i * colW
    doc.rect(x, doc.y, colW - 8, 46).fillAndStroke('#f8fafc', lineColor)
    doc.fillColor('#64748b').fontSize(8).text(s.label.toUpperCase(), x + 10, doc.y + 10)
    doc.fillColor('#0f172a').fontSize(13).text(s.value, x + 10, doc.y + 22, { width: colW - 28 })
    doc.y -= 46
  })
  doc.y += 24

  if (sales.length === 0) {
    doc.fillColor('#0f172a').fontSize(12).text('Aucune vente pour cette période.')
  } else {
    const tableTop = doc.y
    const cols = { date: 100, total: 80, profit: 80, user: 100 }
    const startX = 40

    doc.fontSize(9).fillColor('#64748b')
    doc.text('Date', startX, tableTop)
    doc.text('Total', startX + cols.date, tableTop)
    doc.text('Profit', startX + cols.date + cols.total, tableTop)
    doc.text('Utilisateur', startX + cols.date + cols.total + cols.profit, tableTop)
    doc.moveTo(startX, tableTop + 14).lineTo(doc.page.width - 40, tableTop + 14).strokeColor(lineColor).stroke()

    let y = tableTop + 22
    sales.forEach((sale, i) => {
      if (y > doc.page.height - 80) {
        doc.addPage()
        y = 40
      }
      if (i % 2 === 0) {
        doc.rect(startX, y - 4, doc.page.width - 80, 16).fill('#f8fafc')
      }
      doc.fontSize(9).fillColor('#0f172a')
      doc.text(formatDate(sale.createdAt), startX, y)
      doc.text(formatMoney(sale.total), startX + cols.date, y)
      doc.text(formatMoney(sale.profit), startX + cols.date + cols.total, y)
      doc.text(sale.user?.name || '', startX + cols.date + cols.total + cols.profit, y, { width: cols.user })
      y += 18
    })

    doc.moveTo(startX, y - 6).lineTo(doc.page.width - 40, y - 6).strokeColor(lineColor).stroke()
    doc.fontSize(10).fillColor(headerColor)
    doc.text(`Total: ${formatMoney(totalRevenue)}`, startX, y + 4)
    doc.text(`Profit: ${formatMoney(totalProfit)}`, startX + 150, y + 4)
  }

  doc.end()
  const buffer = await done

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ventes-${period}.pdf"`,
    },
  })
})
