import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generateProductPdf(product) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  
  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(product.name || 'Product Details', { align: 'center' });
  doc.moveDown();
  
  // Product Information Section
  doc.fontSize(14).font('Helvetica-Bold').text('Product Information', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica');
  
  const supplierContact = product.supplierContact || {};
  const supplierLineParts = [];
  if (product.supplierName) supplierLineParts.push(product.supplierName);
  if (product.supplierCompanyName) supplierLineParts.push(product.supplierCompanyName);
  const supplierLine = supplierLineParts.join(' - ') || product.supplier?.name || '-';

  const info = [
    ['SKU:', product.sku || '-'],
    ['Barcode:', product.barcode || '-'],
    ['Category:', product.categoryName || product.category?.name || '-'],
    ['Brand:', product.brandName || product.brand?.name || '-'],
    ['Variant:', product.variantName || product.variant?.name || '-'],
    ['Supplier:', supplierLine],
    ['Supplier Email:', supplierContact.email || product.supplier?.contact?.email || '-'],
    ['Supplier Phone:', supplierContact.phone || product.supplier?.contact?.phone || '-'],
    ['Unit:', product.uom || '-'],
    ['Cost:', typeof product.cost === 'number' ? `$${product.cost.toFixed(2)}` : '-'],
    ['Price:', typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : '-'],
    ['Status:', product.status || 'active']
  ];
  
  info.forEach(([label, value]) => {
    doc.text(`${label} ${value}`, { continued: false });
  });
  
  doc.moveDown();
  
  // Description
  if (product.description) {
    doc.fontSize(14).font('Helvetica-Bold').text('Description', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(product.description, { align: 'left' });
    doc.moveDown();
  }
  
  // Specifications
  if (product.specifications) {
    doc.fontSize(14).font('Helvetica-Bold').text('Specifications', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    
    const specs = product.specifications;
    if (specs.weight) doc.text(`Weight: ${specs.weight}`);
    if (specs.dimensions) {
      doc.text(`Dimensions: ${specs.dimensions.length || 0} x ${specs.dimensions.width || 0} x ${specs.dimensions.height || 0} ${specs.dimensions.unit || 'cm'}`);
    }
    if (specs.color) doc.text(`Color: ${specs.color}`);
    if (specs.material) doc.text(`Material: ${specs.material}`);
    if (specs.manufacturer) doc.text(`Manufacturer: ${specs.manufacturer}`);
    if (specs.countryOfOrigin) doc.text(`Country of Origin: ${specs.countryOfOrigin}`);
    doc.moveDown();
  }
  
  // Footer
  doc.fontSize(8).fillColor('#666666').text(
    `Generated on: ${new Date().toLocaleString()}`,
    50,
    doc.page.height - 50,
    { align: 'center' }
  );
  
  return new Promise((resolve) => {
    const buffer = [];
    doc.on('data', (d) => buffer.push(d));
    doc.on('end', () => resolve(Buffer.concat(buffer)));
    doc.end();
  });
}

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

