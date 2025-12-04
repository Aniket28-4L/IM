import PDFDocument from 'pdfkit';

export function generateLabelsPdf(labels = [], options = { paper: 'A4' }) {
  const doc = new PDFDocument({ size: options.paper?.toUpperCase() === 'A4' ? 'A4' : 'LETTER', margin: 20 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => {});

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = options.columns || 3;
  const colWidth = pageWidth / cols;
  let x = doc.page.margins.left, y = doc.page.margins.top;
  let col = 0;

  labels.forEach((label, idx) => {
    doc.rect(x, y, colWidth - 8, 120).stroke('#e5e7eb');
    doc.fontSize(10).text(label.name || '', x + 8, y + 8, { width: colWidth - 24, ellipsis: true });
    doc.fontSize(8).fillColor('#6b7280').text(`${label.sku || ''} • $${(label.price ?? 0).toFixed(2)}`, x + 8, y + 24);
    if (label.barcodeBuffer) {
      try {
        doc.image(label.barcodeBuffer, x + 8, y + 40, { width: colWidth - 24, height: 50, align: 'center' });
      } catch {}
    }
    if (label.qrBuffer) {
      try {
        doc.image(label.qrBuffer, x + colWidth - 8 - 52, y + 8, { width: 44, height: 44 });
      } catch {}
    }
    col++;
    if (col >= cols) {
      col = 0; x = doc.page.margins.left; y += 130;
      if (y + 130 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage(); y = doc.page.margins.top;
      }
    } else {
      x += colWidth;
    }
  });

  doc.end();
  return new Promise((resolve) => {
    const buffer = [];
    doc.on('data', (d) => buffer.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffer)));
  });
}

