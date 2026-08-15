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

const INDIGO = '#4338ca'
const INDIGO_LIGHT = '#eef2ff'
const SLATE_700 = '#334155'
const SLATE_500 = '#64748b'
const SLATE_400 = '#94a3b8'
const LINE = '#e2e8f0'
const BG_ZEBRA = '#f8fafc'

function formatMoney(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' MAD'
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
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

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const pageW = doc.page.width
  const pageH = doc.page.height
  const margin = 50
  const contentW = pageW - margin * 2

  // ---------- Header band ----------
  doc.rect(0, 0, pageW, 78).fill(INDIGO)
  doc.fillColor('#ffffff').fontSize(17).font('Helvetica-Bold').text(LABELS[period] || LABELS.month, margin, 22, {
    width: contentW,
    align: 'center',
  })
  doc.fontSize(9).font('Helvetica').fillColor('#c7d2fe').text(`Généré le ${formatTime(new Date())}`, margin, 48, {
    width: contentW,
    align: 'center',
  })
  doc.y = 78 + 24

  // ---------- Summary cards ----------
  const cards = [
    { label: 'Nombre de ventes', value: String(sales.length) },
    { label: 'Revenus totaux', value: formatMoney(totalRevenue) },
    { label: 'Profit total', value: formatMoney(totalProfit) },
  ]
  const gap = 12
  const cardW = (contentW - gap * 2) / 3
  cards.forEach((s, i) => {
    const x = margin + i * (cardW + gap)
    doc.roundedRect(x, doc.y, cardW, 52, 6).fillAndStroke('#ffffff', LINE)
    doc.rect(x, doc.y, cardW, 3).fill(INDIGO)
    doc.fillColor(SLATE_500).font('Helvetica').fontSize(7.5).text(s.label.toUpperCase(), x + 10, doc.y + 10, { width: cardW - 20 })
    doc.fillColor(SLATE_700).font('Helvetica-Bold').fontSize(13).text(s.value, x + 10, doc.y + 24, { width: cardW - 20 })
  })
  doc.y += 52 + 24

  // ---------- Table ----------
  const startX = margin
  const cols = { date: 150, total: 100, profit: 100 }
  const userX = startX + cols.date + cols.total + cols.profit
  const userW = contentW - (cols.date + cols.total + cols.profit)
  const headerH = 26
  const rowH = 20

  if (sales.length === 0) {
    doc.moveDown(1)
    doc.fillColor(SLATE_500).font('Helvetica').fontSize(11).text('Aucune vente pour cette période.', { align: 'center' })
  } else {
    // table header
    const headerY = doc.y
    doc.rect(startX, headerY, contentW, headerH).fill(INDIGO)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    doc.text('Date', startX + 8, headerY + 8)
    doc.text('Total', startX + cols.date, headerY + 8)
    doc.text('Profit', startX + cols.date + cols.total, headerY + 8)
    doc.text('Utilisateur', userX, headerY + 8)
    doc.y = headerY + headerH

    let y = headerY + headerH
    sales.forEach((sale, i) => {
      if (y + rowH > pageH - 60) {
        doc.addPage()
        y = 40
        doc.rect(startX, y, contentW, headerH).fill(INDIGO)
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
        doc.text('Date', startX + 8, y + 8)
        doc.text('Total', startX + cols.date, y + 8)
        doc.text('Profit', startX + cols.date + cols.total, y + 8)
        doc.text('Utilisateur', userX, y + 8)
        y += headerH
      }
      if (i % 2 === 1) {
        doc.rect(startX, y, contentW, rowH).fill(BG_ZEBRA)
      }
      doc.fillColor(SLATE_700).font('Helvetica').fontSize(8.5)
      doc.text(formatDate(sale.createdAt), startX + 8, y + 6)
      doc.text(formatMoney(sale.total), startX + cols.date, y + 6)
      doc.text(formatMoney(sale.profit), startX + cols.date + cols.total, y + 6)
      doc.text(sale.user?.name || '', userX, y + 6, { width: userW - 8 })
      y += rowH
    })

    // total row
    doc.moveTo(startX, y).lineTo(pageW - margin, y).strokeColor(LINE).lineWidth(1).stroke()
    y += 8
    doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(10)
    doc.text(`Total: ${formatMoney(totalRevenue)}`, startX, y)
    doc.text(`Profit: ${formatMoney(totalProfit)}`, startX + 150, y)
    doc.y = y + 16
  }

  // ---------- Footer (every page) ----------
  const pages = doc.bufferedPageRange()
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i)
    const footerY = pageH - 36
    doc.moveTo(margin, footerY).lineTo(pageW - margin, footerY).strokeColor(LINE).lineWidth(0.5).stroke()
    doc.fillColor(SLATE_400).font('Helvetica').fontSize(8).text(
      `Rapport des ventes — Page ${i + 1} / ${pages.count}`,
      margin,
      footerY + 6,
      { width: contentW, align: 'left' }
    )
    doc.text(formatMoney(totalRevenue), margin, footerY + 6, { width: contentW, align: 'right' })
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
