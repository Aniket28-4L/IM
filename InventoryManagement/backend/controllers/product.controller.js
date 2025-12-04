import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Stock from '../models/Stock.js';
import { parseFileToJson, jsonToWorkbook } from '../utils/csv.js';

export async function createProduct(req, res, next) {
  try {
    const body = req.body;
    if (req.files?.images) {
      body.images = req.files.images.map((f) => `/uploads/${f.filename}`);
    }
    const product = await Product.create(body);
    res.json({ success: true, data: product });
  } catch (e) { next(e); }
}

export async function listProducts(req, res, next) {
  try {
    const { page = 1, limit = 10, q, category, brand } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { sku: new RegExp(q, 'i') },
        { barcode: new RegExp(q, 'i') }
      ];
    }
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    const total = await Product.countDocuments(filter);
    const data = await Product.find(filter)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('variant', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    const mapped = data.map((item) => ({
      ...item,
      categoryName: item.category && typeof item.category === 'object' ? item.category.name : null,
      category: item.category && typeof item.category === 'object' ? item.category._id : item.category,
      brandName: item.brand && typeof item.brand === 'object' ? item.brand.name : null,
      brand: item.brand && typeof item.brand === 'object' ? item.brand._id : item.brand,
      variantName: item.variant && typeof item.variant === 'object' ? item.variant.name : null,
      variant: item.variant && typeof item.variant === 'object' ? item.variant._id : item.variant
    }));
    res.json({ success: true, data: mapped, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
}

export async function getProduct(req, res, next) {
  try {
    const p = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('variant', 'name')
      .lean();
    if (!p) return res.status(404).json({ success: false, message: 'Not found' });
    const data = p && {
      ...p,
      categoryName: p.category && typeof p.category === 'object' ? p.category.name : null,
      category: p.category && typeof p.category === 'object' ? p.category._id : p.category,
      brandName: p.brand && typeof p.brand === 'object' ? p.brand.name : null,
      brand: p.brand && typeof p.brand === 'object' ? p.brand._id : p.brand,
      variantName: p.variant && typeof p.variant === 'object' ? p.variant.name : null,
      variant: p.variant && typeof p.variant === 'object' ? p.variant._id : p.variant
    };
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateProduct(req, res, next) {
  try {
    const body = req.body;
    if (req.files?.images) {
      body.images = req.files.images.map((f) => `/uploads/${f.filename}`);
    }
    const p = await Product.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json({ success: true, data: p });
  } catch (e) { next(e); }
}

export async function deleteProduct(req, res, next) {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function importProducts(req, res, next) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const rows = parseFileToJson(file.buffer);
    const docs = await Product.insertMany(rows.map((r) => ({
      name: r.name, sku: r.sku, barcode: r.barcode, uom: r.uom, cost: Number(r.cost || 0), price: Number(r.price || 0), description: r.description
    })), { ordered: false });
    res.json({ success: true, inserted: docs.length });
  } catch (e) { next(e); }
}

export async function exportProducts(req, res, next) {
  try {
    const products = await Product.find().lean();
    const data = products.map((p) => ({ name: p.name, sku: p.sku, barcode: p.barcode, uom: p.uom, cost: p.cost, price: p.price, description: p.description }));
    const wb = jsonToWorkbook(data);
    const base64 = wb.toString('base64');
    res.json({ success: true, filename: 'products.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 });
  } catch (e) { next(e); }
}

export async function createCategory(req, res, next) {
  try {
    const c = await Category.create(req.body);
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
}

export async function listCategories(req, res, next) {
  try {
    const list = await Category.find().lean();
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
}

export async function createBrand(req, res, next) {
  try {
    const b = await Brand.create(req.body);
    res.json({ success: true, data: b });
  } catch (e) { next(e); }
}

export async function listBrands(req, res, next) {
  try {
    const list = await Brand.find().lean();
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
}

export async function getProductStock(req, res, next) {
  try {
    const { id } = req.params;
    const stock = await Stock.find({ product: id })
      .populate('warehouse', 'name code')
      .populate('location', 'zone shelf bin')
      .sort({ warehouse: 1 })
      .lean();
    res.json({ success: true, data: stock });
  } catch (e) { next(e); }
}

