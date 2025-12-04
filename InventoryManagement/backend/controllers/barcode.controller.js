import { generateCode128, generateQr } from '../utils/barcode.js';
import { generateLabelsPdf } from '../utils/pdf.js';
import Product from '../models/Product.js';

export async function generate(req, res, next) {
  try {
    const { type = 'code128', value, productId } = req.body;
    if (!value) return res.status(400).json({ success: false, message: 'Missing value' });
    const buffer = type === 'qr' ? await generateQr(value) : await generateCode128(value);
    if (productId) {
      try {
        await Product.findByIdAndUpdate(productId, { barcode: String(value) }, { new: false });
      } catch (err) {
      }
    }
    res.json({ success: true, mime: 'image/png', base64: buffer.toString('base64') });
  } catch (e) { next(e); }
}

export async function printLabels(req, res, next) {
  try {
    const { productIds = [], layout = 'a4' } = req.body;
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const labels = await Promise.all(products.map(async (p) => ({
      name: p.name, sku: p.sku, price: p.price, barcodeBuffer: await generateCode128(p.barcode || p.sku)
    })));
    const pdfBuffer = await generateLabelsPdf(labels, { paper: layout === 'a4' ? 'A4' : 'LETTER', columns: layout === 'a4' ? 3 : 2 });
    res.json({ success: true, mime: 'application/pdf', base64: pdfBuffer.toString('base64') });
  } catch (e) { next(e); }
}

