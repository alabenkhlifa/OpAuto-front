// pdfkit is CJS — use require so the default export works at runtime regardless of esModuleInterop.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument: typeof import('pdfkit') = require('pdfkit');

export interface InvoicePdfLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePdfRow {
  invoiceNumber: string;
  status: string;
  customer: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  carLabel?: string | null;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: string;
  createdAt: string;
  paidAt?: string | null;
  lineItems: InvoicePdfLine[];
}

export interface InvoicePdfOptions {
  garageName: string;
  garageAddress?: string | null;
  garagePhone?: string | null;
  garageEmail?: string | null;
}

const COLORS = {
  brand: '#FF8400',
  text: '#111827',
  subtle: '#6b7280',
  border: '#e5e7eb',
  paidBg: '#d1fae5',
  paidFg: '#065f46',
  sentBg: '#dbeafe',
  sentFg: '#1e40af',
  overdueBg: '#fee2e2',
  overdueFg: '#991b1b',
  draftBg: '#f3f4f6',
  draftFg: '#374151',
};

function statusColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'PAID':            return { bg: COLORS.paidBg,    fg: COLORS.paidFg };
    case 'SENT':
    case 'PARTIALLY_PAID':  return { bg: COLORS.sentBg,    fg: COLORS.sentFg };
    case 'OVERDUE':         return { bg: COLORS.overdueBg, fg: COLORS.overdueFg };
    default:                return { bg: COLORS.draftBg,   fg: COLORS.draftFg };
  }
}

const fmtTND = (n: number) => `${n.toFixed(2)} TND`;

/**
 * Render a multi-page PDF — one invoice per page — and resolve with a Buffer.
 */
export function invoicesToPdf(
  rows: InvoicePdfRow[],
  opts: InvoicePdfOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    rows.forEach((row, idx) => {
      if (idx > 0) doc.addPage();
      drawInvoice(doc, row, opts, idx + 1, rows.length);
    });

    doc.end();
  });
}

function drawInvoice(
  doc: PDFKit.PDFDocument,
  row: InvoicePdfRow,
  opts: InvoicePdfOptions,
  pageNum: number,
  pageCount: number,
) {
  const { width } = doc.page;
  const left = doc.page.margins.left;
  const right = width - doc.page.margins.right;
  const usableWidth = right - left;

  // ── Header band ─────────────────────────────────────────────────
  doc
    .fillColor(COLORS.brand)
    .fontSize(22)
    .font('Helvetica-Bold')
    .text(opts.garageName, left, 48);

  if (opts.garageAddress) {
    doc.fillColor(COLORS.subtle).fontSize(9).font('Helvetica').text(opts.garageAddress, left, 74);
  }
  if (opts.garagePhone || opts.garageEmail) {
    doc.text([opts.garagePhone, opts.garageEmail].filter(Boolean).join('  ·  '), left, 88);
  }

  // Invoice number + status pill — right-aligned
  doc
    .fillColor(COLORS.text)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('INVOICE', right - 220, 48, { width: 220, align: 'right' });
  doc
    .fillColor(COLORS.subtle)
    .fontSize(11)
    .font('Helvetica')
    .text(row.invoiceNumber, right - 220, 74, { width: 220, align: 'right' });

  const sc = statusColors(row.status);
  const pillText = row.status;
  const pillW = doc.widthOfString(pillText) + 16;
  const pillX = right - pillW;
  const pillY = 92;
  doc.roundedRect(pillX, pillY, pillW, 18, 9).fillColor(sc.bg).fill();
  doc
    .fillColor(sc.fg)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(pillText, pillX, pillY + 5, { width: pillW, align: 'center' });

  // Divider
  doc
    .moveTo(left, 124)
    .lineTo(right, 124)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();

  // ── Customer + dates block ──────────────────────────────────────
  const blockY = 140;
  doc.fillColor(COLORS.subtle).fontSize(9).font('Helvetica-Bold').text('BILL TO', left, blockY);
  doc.fillColor(COLORS.text).fontSize(12).font('Helvetica-Bold').text(row.customer, left, blockY + 14);

  let detailY = blockY + 32;
  doc.fillColor(COLORS.subtle).fontSize(10).font('Helvetica');
  if (row.customerPhone) { doc.text(row.customerPhone, left, detailY); detailY += 13; }
  if (row.customerEmail) { doc.text(row.customerEmail, left, detailY); detailY += 13; }
  if (row.customerAddress) { doc.text(row.customerAddress, left, detailY); detailY += 13; }
  if (row.carLabel) {
    doc.fillColor(COLORS.subtle).fontSize(9).font('Helvetica-Bold').text('VEHICLE', left, detailY + 4);
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica').text(row.carLabel, left, detailY + 17);
  }

  // Right column: dates
  const dateColX = right - 200;
  doc.fillColor(COLORS.subtle).fontSize(9).font('Helvetica-Bold').text('ISSUED', dateColX, blockY, { width: 200, align: 'right' });
  doc.fillColor(COLORS.text).fontSize(11).font('Helvetica').text(row.createdAt, dateColX, blockY + 14, { width: 200, align: 'right' });

  if (row.dueDate) {
    doc.fillColor(COLORS.subtle).fontSize(9).font('Helvetica-Bold').text('DUE', dateColX, blockY + 36, { width: 200, align: 'right' });
    doc.fillColor(COLORS.text).fontSize(11).font('Helvetica').text(row.dueDate, dateColX, blockY + 50, { width: 200, align: 'right' });
  }
  if (row.paidAt) {
    doc.fillColor(COLORS.subtle).fontSize(9).font('Helvetica-Bold').text('PAID ON', dateColX, blockY + 72, { width: 200, align: 'right' });
    doc.fillColor(COLORS.paidFg).fontSize(11).font('Helvetica').text(row.paidAt, dateColX, blockY + 86, { width: 200, align: 'right' });
  }

  // ── Line items table ────────────────────────────────────────────
  const tableTop = 252;
  const colDescX = left;
  const colQtyX = left + usableWidth * 0.55;
  const colPriceX = left + usableWidth * 0.7;
  const colTotalX = left + usableWidth * 0.85;
  const colTotalRight = right;

  doc.fillColor(COLORS.subtle).fontSize(9).font('Helvetica-Bold');
  doc.text('DESCRIPTION', colDescX, tableTop);
  doc.text('QTY', colQtyX, tableTop, { width: usableWidth * 0.13, align: 'right' });
  doc.text('UNIT', colPriceX, tableTop, { width: usableWidth * 0.13, align: 'right' });
  doc.text('TOTAL', colTotalX, tableTop, { width: colTotalRight - colTotalX, align: 'right' });

  doc
    .moveTo(left, tableTop + 14)
    .lineTo(right, tableTop + 14)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();

  let cursorY = tableTop + 22;
  doc.fillColor(COLORS.text).fontSize(10).font('Helvetica');

  if (row.lineItems.length === 0) {
    doc.fillColor(COLORS.subtle).font('Helvetica-Oblique').text('(no line items)', left, cursorY);
    cursorY += 16;
  } else {
    for (const li of row.lineItems) {
      const descHeight = doc.heightOfString(li.description, { width: usableWidth * 0.5 });
      doc.fillColor(COLORS.text).font('Helvetica').text(li.description, colDescX, cursorY, { width: usableWidth * 0.5 });
      doc.text(li.quantity.toString(), colQtyX, cursorY, { width: usableWidth * 0.13, align: 'right' });
      doc.text(fmtTND(li.unitPrice), colPriceX, cursorY, { width: usableWidth * 0.13, align: 'right' });
      doc.text(fmtTND(li.total), colTotalX, cursorY, { width: colTotalRight - colTotalX, align: 'right' });
      cursorY += Math.max(descHeight, 14) + 4;
    }
  }

  // ── Totals block (right-aligned) ────────────────────────────────
  const totalsY = Math.max(cursorY + 18, 480);
  const totalsLeft = left + usableWidth * 0.55;
  const labelW = usableWidth * 0.25;
  const valueW = usableWidth * 0.2;

  function row2(label: string, value: string, opts?: { bold?: boolean; color?: string }) {
    doc
      .fillColor(opts?.color ?? COLORS.subtle)
      .fontSize(10)
      .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(label, totalsLeft, totalsY + row2.idx * 16, { width: labelW, align: 'right' });
    doc
      .fillColor(opts?.color ?? COLORS.text)
      .text(value, totalsLeft + labelW + 8, totalsY + row2.idx * 16, { width: valueW, align: 'right' });
    row2.idx++;
  }
  row2.idx = 0;

  row2('Subtotal', fmtTND(row.subtotal));
  if (row.discount) row2('Discount', `− ${fmtTND(row.discount)}`);
  row2('Tax (19%)', fmtTND(row.taxAmount));

  doc
    .moveTo(totalsLeft, totalsY + row2.idx * 16 + 4)
    .lineTo(right, totalsY + row2.idx * 16 + 4)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();
  row2.idx += 1;

  row2('Total', fmtTND(row.total), { bold: true, color: COLORS.text });

  if (row.paid > 0) {
    row2.idx += 0.3;
    row2('Paid', `− ${fmtTND(row.paid)}`, { color: COLORS.paidFg });
    if (row.outstanding > 0) {
      row2('Outstanding', fmtTND(row.outstanding), { bold: true, color: COLORS.overdueFg });
    }
  }

  // ── Footer ──────────────────────────────────────────────────────
  const footY = doc.page.height - doc.page.margins.bottom - 14;
  doc
    .fillColor(COLORS.subtle)
    .fontSize(8)
    .font('Helvetica')
    .text(`Page ${pageNum} of ${pageCount}`, left, footY, { width: usableWidth / 2 })
    .text(`Generated ${new Date().toISOString().slice(0, 10)}`, left + usableWidth / 2, footY, {
      width: usableWidth / 2,
      align: 'right',
    });
}
