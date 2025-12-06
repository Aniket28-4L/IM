import { generateCode128, generateQr } from '../utils/barcode.js';
import { generateLabelsPdf } from '../utils/pdf.js';
import Product from '../models/Product.js';

export async function generate(req, res, next) {
  try {
    const { type = 'code128', value, productId } = req.body;
    if (!value) return res.status(400).json({ success: false, message: 'Missing value' });
    
    // If productId is provided, get product and use its barcode and PDF URL
    let barcodeValue = value;
    let qrValue = value;
    
    if (productId) {
      try {
        const product = await Product.findById(productId).lean();
        if (product) {
          // Use product's barcode value
          barcodeValue = product.barcode || product.sku || value;
          
          // For QR code, include PDF URL if available
          if (type === 'qr' && product.pdfUrl) {
            // Generate full URL for QR code
            const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
            qrValue = `${baseUrl}${product.pdfUrl}`;
          } else {
            qrValue = barcodeValue;
          }
          
          // Update product barcode if not set
          if (!product.barcode) {
            await Product.findByIdAndUpdate(productId, { barcode: String(barcodeValue) }, { new: false });
          }
        }
      } catch (err) {
        console.error('Error fetching product:', err);
      }
    }
    
    const finalValue = type === 'qr' ? qrValue : barcodeValue;
    const buffer = type === 'qr' ? await generateQr(finalValue) : await generateCode128(finalValue);
    
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

export async function scanBarcode(req, res, next) {
  try {
    const { barcode } = req.query;
    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }
    
    // Search for product by barcode or SKU
    const product = await Product.findOne({
      $or: [
        { barcode: String(barcode) },
        { sku: String(barcode) }
      ]
    })
    .populate('category', 'name')
    .populate('brand', 'name')
    .populate('variant', 'name')
    .lean();
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found for this barcode' 
      });
    }
    
    // Generate PDF URL if not exists
    let pdfUrl = product.pdfUrl;
    if (!pdfUrl) {
      pdfUrl = `/api/products/${product._id}/pdf`;
    }
    
    // Map product data with PDF URL
    const productData = {
      ...product,
      categoryName: product.category && typeof product.category === 'object' ? product.category.name : null,
      brandName: product.brand && typeof product.brand === 'object' ? product.brand.name : null,
      variantName: product.variant && typeof product.variant === 'object' ? product.variant.name : null,
      pdfUrl
    };
    
    res.json({
      success: true,
      data: productData
    });
  } catch (e) {
    next(e);
  }
}

