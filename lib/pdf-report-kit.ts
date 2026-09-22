import PDFDocument from 'pdfkit'

export const INDIGO = '#4338ca'
export const INDIGO_DARK = '#3730a3'
export const EMERALD = '#059669'
export const AMBER = '#d97706'
export const ROSE = '#e11d48'
export const SLATE_800 = '#1e293b'
export const SLATE_700 = '#334155'
export const SLATE_500 = '#64748b'
export const SLATE_400 = '#94a3b8'
export const LINE = '#e2e8f0'
export const BG_ZEBRA = '#f8fafc'

export const MARGIN = 50
export const TOP_SAFE = 44
export const BOTTOM_SAFE = 70

export function formatMoney(n: number) {
  return (
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n)
      // Helvetica has no glyph for the narrow no-break space Intl uses as a thousands separator
      .replace(/[  ]/g, ' ') + ' MAD'
  )
}

export function formatDate(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export function formatTime(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

export function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

export type Column<T> = {
  label: string
  width: number
  align?: 'left' | 'right'
  value: (row: T) => string
  color?: (row: T) => string
}

// margin: 0 — pagination is handled entirely by ensureSpace()/drawTable() below via
// TOP_SAFE/BOTTOM_SAFE. A non-zero document margin makes PDFKit's own overflow check
// (based on page.height - margins.bottom) fire when the footer is drawn near the
// physical bottom edge, silently inserting extra blank pages.
export function createReportDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  return { doc, done }
}

export function drawHeaderBand(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  const pageW = doc.page.width
  const contentW = pageW - MARGIN * 2
  doc.rect(0, 0, pageW, 84).fill(INDIGO)
  doc.rect(0, 80, pageW, 4).fill(INDIGO_DARK)
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(19).text(title, MARGIN, 20, {
    width: contentW,
    align: 'center',
  })
  doc.fillColor('#c7d2fe').font('Helvetica').fontSize(9.5).text(subtitle, MARGIN, 47, {
    width: contentW,
    align: 'center',
  })
  doc.y = 84 + 24
}

export function drawFooter(doc: PDFKit.PDFDocument, title: string, rightValue: string) {
  const pageW = doc.page.width
  const pageH = doc.page.height
  const contentW = pageW - MARGIN * 2
  const pages = doc.bufferedPageRange()
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i)
    const footerY = pageH - 36
    doc.moveTo(MARGIN, footerY).lineTo(pageW - MARGIN, footerY).strokeColor(LINE).lineWidth(0.5).stroke()
    doc.fillColor(SLATE_400).font('Helvetica').fontSize(8).text(
      `${title} — Page ${i + 1} / ${pages.count}`,
      MARGIN,
      footerY + 6,
      { width: contentW, align: 'left' }
    )
    doc.text(rightValue, MARGIN, footerY + 6, { width: contentW, align: 'right' })
  }
}

export type Kpi = { label: string; value: string; color: string }

export function drawKpiGrid(doc: PDFKit.PDFDocument, kpis: Kpi[], columns = 3, cardH = 54) {
  const contentW = doc.page.width - MARGIN * 2
  const gap = 12
  const cardW = (contentW - gap * (columns - 1)) / columns
  const rows = Math.ceil(kpis.length / columns)
  for (let r = 0; r < rows; r++) {
    ensureSpace(doc, cardH + gap)
    const y = doc.y
    for (let c = 0; c < columns; c++) {
      const idx = r * columns + c
      if (idx >= kpis.length) break
      const kpi = kpis[idx]
      const x = MARGIN + c * (cardW + gap)
      doc.roundedRect(x, y, cardW, cardH, 6).fillAndStroke('#ffffff', LINE)
      doc.rect(x, y, 3, cardH).fill(INDIGO)
      doc.fillColor(SLATE_500).font('Helvetica').fontSize(7.5).text(kpi.label.toUpperCase(), x + 12, y + 11, { width: cardW - 22 })
      doc.fillColor(kpi.color).font('Helvetica-Bold').fontSize(12.5).text(kpi.value, x + 12, y + 27, { width: cardW - 22 })
    }
    doc.y = y + cardH + gap
  }
  doc.y += 6
}

export function sectionTitle(doc: PDFKit.PDFDocument, text: string, x: number, width: number) {
  ensureSpace(doc, 34)
  const y = doc.y
  doc.rect(x, y + 3, 3, 11).fill(INDIGO)
  doc.fillColor(SLATE_800).font('Helvetica-Bold').fontSize(11).text(text, x + 10, y, { width: width - 10 })
  doc.y = y + 22
}

export function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const pageH = doc.page.height
  if (doc.y + height > pageH - BOTTOM_SAFE) {
    doc.addPage()
    doc.y = TOP_SAFE
  }
}

export function drawTable<T>(
  doc: PDFKit.PDFDocument,
  x: number,
  width: number,
  columns: Column<T>[],
  rows: T[],
  emptyLabel: string
) {
  const headerH = 22
  const rowH = 19

  if (rows.length === 0) {
    ensureSpace(doc, 30)
    doc.fillColor(SLATE_400).font('Helvetica-Oblique').fontSize(9).text(emptyLabel, x, doc.y, { width })
    doc.y += 24
    return
  }

  const drawHeader = (y: number) => {
    doc.rect(x, y, width, headerH).fill(INDIGO)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5)
    let cx = x
    for (const col of columns) {
      doc.text(col.label, cx + 8, y + 7, { width: col.width - 12, align: col.align || 'left' })
      cx += col.width
    }
  }

  ensureSpace(doc, headerH + rowH)
  drawHeader(doc.y)
  doc.y += headerH

  rows.forEach((row, i) => {
    if (doc.y + rowH > doc.page.height - BOTTOM_SAFE) {
      doc.addPage()
      doc.y = TOP_SAFE
      drawHeader(doc.y)
      doc.y += headerH
    }
    const y = doc.y
    if (i % 2 === 1) doc.rect(x, y, width, rowH).fill(BG_ZEBRA)
    doc.font('Helvetica').fontSize(8.5)
    let cx = x
    for (const col of columns) {
      doc.fillColor(col.color ? col.color(row) : SLATE_700)
      doc.text(col.value(row), cx + 8, y + 5, { width: col.width - 12, align: col.align || 'left' })
      cx += col.width
    }
    doc.y = y + rowH
  })

  doc.moveTo(x, doc.y).lineTo(x + width, doc.y).strokeColor(LINE).lineWidth(1).stroke()
  doc.y += 18
}
