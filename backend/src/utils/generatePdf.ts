import PDFDocument from 'pdfkit';
import { Writable } from 'node:stream';
import { Summary } from '../controllers/summary.service';

const GREEN = '#087A43';
const LIGHT = '#EAF7EE';
const BORDER = '#DFE9E1';
const MUTED = '#65746A';

/**
 * PDF labels are English on purpose: PDFKit's bundled fonts have no
 * Devanagari glyphs, and Hindi would render as blank boxes without
 * shipping a Unicode TTF.
 */
const SHIFT = { morning: 'Morning', evening: 'Evening' } as const;
const TYPE = { buffalo: 'Buffalo', cow: 'Cow' } as const;

// 'Rs.' not the rupee glyph: Helvetica has no U+20B9.
const money = (n: number) =>
  'Rs.' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const litres = (n: number) => n.toFixed(2) + ' L';

interface Col {
  key: string;
  label: string;
  width: number;
  right?: boolean;
}

const COLS: Col[] = [
  { key: 'date', label: 'Date', width: 74 },
  { key: 'shift', label: 'Shift', width: 56 },
  { key: 'milkType', label: 'Type', width: 52 },
  { key: 'qty', label: 'Qty (L)', width: 52, right: true },
  { key: 'fat', label: 'Fat %', width: 44, right: true },
  { key: 'rate', label: 'Rate', width: 70, right: true },
  { key: 'amount', label: 'Amount', width: 82, right: true },
];

export interface PdfInput {
  dairyName: string;
  ownerName: string;
  summary: Summary;
  entries: any[];
}

export function generateReportPdf(out: Writable, { dairyName, ownerName, summary, entries }: PdfInput) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.pipe(out);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  // --- Header -------------------------------------------------------------
  doc.rect(0, 0, doc.page.width, 92).fill(GREEN);
  doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('VTG MilkSetu', left, 26);
  doc.fontSize(10).font('Helvetica').text('Dairy Milk Collection Report', left, 52);
  doc
    .fontSize(9)
    .text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, left, 68);

  doc.fillColor('#17231C').font('Helvetica-Bold').fontSize(13).text(dairyName, left, 110);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(MUTED)
    .text(`Owner: ${ownerName}`)
    .text(`Period: ${summary.from} to ${summary.to}`);

  // --- Summary cards ------------------------------------------------------
  let y = doc.y + 14;
  const cards: [string, string][] = [
    ['Total Milk', litres(summary.overall.litres)],
    ['Total Amount', money(summary.overall.amount)],
    ['Morning', `${litres(summary.morning.litres)} / ${money(summary.morning.amount)}`],
    ['Evening', `${litres(summary.evening.litres)} / ${money(summary.evening.amount)}`],
    ['Buffalo', `${litres(summary.buffalo.litres)} / ${money(summary.buffalo.amount)}`],
    ['Cow', `${litres(summary.cow.litres)} / ${money(summary.cow.amount)}`],
  ];
  const cardW = (right - left - 16) / 3;
  cards.forEach(([label, value], i) => {
    const cx = left + (i % 3) * (cardW + 8);
    const cy = y + Math.floor(i / 3) * 52;
    doc.roundedRect(cx, cy, cardW, 44, 6).fillAndStroke(LIGHT, BORDER);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label.toUpperCase(), cx + 8, cy + 8, { width: cardW - 16 });
    doc.fillColor('#17231C').font('Helvetica-Bold').fontSize(11).text(value, cx + 8, cy + 22, { width: cardW - 16 });
  });
  y += 52 * Math.ceil(cards.length / 3) + 6;

  // --- Entry table --------------------------------------------------------
  doc.fillColor('#17231C').font('Helvetica-Bold').fontSize(12).text('Collection Details', left, y);
  y = doc.y + 8;

  const drawHeader = (top: number) => {
    doc.rect(left, top, right - left, 20).fill(GREEN);
    let x = left + 6;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    for (const c of COLS) {
      doc.text(c.label, x, top + 6, { width: c.width - 8, align: c.right ? 'right' : 'left' });
      x += c.width;
    }
    return top + 20;
  };

  y = drawHeader(y);

  if (entries.length === 0) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('No records in this period.', left + 6, y + 10);
  }

  let striped = false;
  for (const e of entries) {
    // New page when the next row would cross the bottom margin.
    if (y + 18 > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      y = drawHeader(doc.page.margins.top);
      striped = false;
    }
    if (striped) doc.rect(left, y, right - left, 18).fill('#F7FBF8');
    striped = !striped;

    const cells: Record<string, string> = {
      date: e.entryDate,
      shift: SHIFT[e.shift as keyof typeof SHIFT],
      milkType: TYPE[e.milkType as keyof typeof TYPE],
      qty: e.quantityLitres.toFixed(2),
      fat: e.fatPercentage.toFixed(1),
      rate: `${money(e.appliedRate)}${e.rateMode === 'perLitre' ? '/L' : '/fat'}`,
      amount: money(e.totalAmount),
    };

    let x = left + 6;
    doc.fillColor('#17231C').font('Helvetica').fontSize(8.5);
    for (const c of COLS) {
      doc.text(cells[c.key], x, y + 5, { width: c.width - 8, align: c.right ? 'right' : 'left' });
      x += c.width;
    }
    doc.moveTo(left, y + 18).lineTo(right, y + 18).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += 18;
  }

  // --- Grand total --------------------------------------------------------
  // 46 = total bar (24) + its offset (4) + clearance for the page footer.
  if (y + 46 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  doc.rect(left, y + 4, right - left, 24).fill(GREEN);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
  doc.text(`GRAND TOTAL   ${litres(summary.overall.litres)}`, left + 6, y + 11);
  doc.text(money(summary.overall.amount), left, y + 11, { width: right - left - 6, align: 'right' });

  // --- Page numbers -------------------------------------------------------
  // The footer must sit INSIDE the bottom margin box. Text written below it
  // overflows and makes PDFKit append a blank page per footer.
  const range = doc.bufferedPageRange();
  const footerY = doc.page.height - doc.page.margins.bottom - 10;
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(`Page ${i + 1} of ${range.count}  -  VTG MilkSetu`, left, footerY, {
        width: right - left,
        align: 'center',
        lineBreak: false,
      });
  }

  doc.flushPages();

  doc.end();
}
